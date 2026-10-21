import type { Org } from '@harness/schema';
import {
  buildPaymentPreflight,
  type Clients,
  getAccount,
  getContractTtl,
  MAX_EXTEND_DAYS,
  simulateExtendTtl,
  simulateRestore,
} from '@harness/stellar-tools';
import type { Storage } from '@harness/storage';
import { type InferUITools, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { ProposeActionInput, proposeAction, resolveSubject } from './org';

export { type ProposeActionInput, proposeAction } from './org';

export const SYSTEM_PROMPT = [
  'Answer the question asked. Use the fewest tool calls needed. For questions about the network or the report, call getMainnetReport once and do not inspect individual contracts. Never call tools for one question you can answer from a previous result. Reply in short plain sentences before any detail.',
  'You work for one demo company, which getOrg returns. Refer to its accounts and contracts by their labels; the tools accept labels. Nothing is signed or sent in this demo; never say you did.',
  `A contract that is archived or has fewer than 30 days left needs fixing: simulate restoring it, or extending it to the network maximum of ${MAX_EXTEND_DAYS} days, then record the fix with proposeAction before you describe it, one per contract.`,
  'Report policy as proposeAction returned it: within policy, or needs approval.',
  'A payment blocked by a missing trustline on one of our own accounts is fixed with sponsor_trustline: the sender sponsors the trustline, which locks 0.5 XLM of reserve. Propose it with that cost.',
].join('\n');

export const orgBrief = (org: Org): string =>
  [
    `The demo company is ${org.name} on ${org.network}.`,
    `Its accounts: ${org.accounts.map((a) => `${a.label} (${a.role})`).join(', ')}.`,
    `Its contracts: ${org.contracts.map((c) => c.label).join(', ')}.`,
    'Use these labels directly; call getOrg only for addresses or the policy.',
  ].join(' ');

export type MainnetReport = {
  summary: {
    total: number;
    failed: number;
    preventable: number;
    retryable: number;
    outOfScope: number;
    startLedger: number | null;
    endLedger: number | null;
    contracts: {
      archived: number;
      expiring30d: number;
      fixCostXlm: number;
      fixCostUsd: number | null;
      extendDays: number;
    } | null;
  };
  topCodes: { code: string; bucket: string; count: number; share: number; fix: string | null }[];
};

export type AgentDeps = { readMainnetReport: () => Promise<MainnetReport> };

const account = z
  .string()
  .describe('An account label or role from getOrg (e.g. treasury), or its address');
const contract = z.string().describe('A contract label from getOrg (e.g. Escrow), or its id');

const simulationSource = (org: Org): string =>
  (org.accounts.find((a) => a.role === 'treasury') ?? org.accounts[0])?.address ?? '';

export const createAgentTools = (storage: Storage, clients: Clients, deps: AgentDeps) => {
  const resolve = async (ref: string) => resolveSubject(await storage.getOrg(), ref);
  const source = async () => simulationSource(await storage.getOrg());

  return {
    getOrg: tool({
      description:
        'Read-only. Returns the organisation this harness operates for: its name, network, accounts (address, label, role), contracts (id, label) and policy (daily spend limit, allowed operations, approval threshold in XLM). Every other tool works only on these subjects.',
      inputSchema: z.object({}),
      execute: () => storage.getOrg(),
    }),
    getAccount: tool({
      description:
        'Read-only. Loads one of our accounts from Horizon: whether it exists, its XLM balance, sequence number, number of signers and its trustlines with balances and limits.',
      inputSchema: z.object({ account }),
      execute: async ({ account }) => getAccount(clients, await resolve(account)),
    }),
    getContractTtl: tool({
      description:
        'Read-only. Reads one of our contracts from Soroban RPC: days left before the instance and its wasm code are archived, whether either is already archived, and the wasm hash.',
      inputSchema: z.object({ contract }),
      execute: async ({ contract }) => getContractTtl(clients, await resolve(contract)),
    }),
    simulateExtendTtl: tool({
      description:
        'Simulate-only. Asks Soroban RPC simulateTransaction what an ExtendFootprintTTL for the contract instance and its wasm code would cost, extending them to the given number of days from now. Nothing is signed or submitted. Returns the operation, the resource fee in stroops and the estimated cost in XLM.',
      inputSchema: z.object({ contract, days: z.number().int().min(1).max(MAX_EXTEND_DAYS) }),
      execute: async ({ contract, days }) =>
        simulateExtendTtl(clients, {
          contractId: await resolve(contract),
          days,
          source: await source(),
        }),
    }),
    simulateRestore: tool({
      description:
        'Simulate-only. Asks Soroban RPC simulateTransaction what a RestoreFootprint for an archived contract instance and its wasm code would cost. Nothing is signed or submitted. Returns the operation, the resource fee in stroops and the estimated cost in XLM.',
      inputSchema: z.object({ contract }),
      execute: async ({ contract }) =>
        simulateRestore(clients, { contractId: await resolve(contract), source: await source() }),
    }),
    buildPaymentPreflight: tool({
      description:
        'Read-only. Checks whether a payment between our accounts would succeed before anyone builds it: that the receiver exists and trusts the asset, and that the sender holds enough of it without breaking its XLM reserve. Returns ok, or the blockers, each with its result code, a plain explanation and the fix.',
      inputSchema: z.object({
        from: account,
        to: account,
        asset: z
          .string()
          .describe('XLM, an asset code the sender holds (e.g. USDC), or CODE:ISSUER'),
        amount: z.number().positive(),
      }),
      execute: async ({ from, to, asset, amount }) =>
        buildPaymentPreflight(clients, {
          from: await resolve(from),
          to: await resolve(to),
          asset,
          amount,
        }),
    }),
    getMainnetReport: tool({
      description:
        'Read-only. Returns the last 24 hours of Stellar mainnet from the harness report: total and failed transactions, failures split into preventable (the harness would have caught them), retryable and out of scope, the ledger range, active contracts archived or expiring within 30 days with the cost to fix them in XLM and USD and how many days that fix keeps them alive, and the most common failure codes with their share and fix. Call it once for any question about mainnet or the report.',
      inputSchema: z.object({}),
      execute: () => deps.readMainnetReport(),
    }),
    proposeAction: tool({
      description:
        "Records a proposed fix for one of our subjects so the owner can see it. Give the subject (a label or id), a short title, one plain sentence on why, the operation (one of the policy's allowed operations, or unsupported) and the estimated cost in XLM when known. Returns the action with withinPolicy computed against the policy. It does not execute anything.",
      inputSchema: ProposeActionInput,
      execute: (input) => proposeAction(storage, input),
    }),
  };
};

export type AgentTools = ReturnType<typeof createAgentTools>;
export type HarnessMessage = UIMessage<unknown, never, InferUITools<AgentTools>>;
