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
  "You are Stellar Harness, the operator agent for one organisation. You only talk about this organisation's accounts and contracts, which you get from getOrg. Use tools before stating any fact. When you notice something that needs fixing, call simulate tools to get the cost, then call proposeAction. Say in one or two plain sentences what you found, what you propose, what it costs, and whether it is within the organisation's policy. You cannot execute anything in this demo; never say you did. Be terse. No marketing language.",
  'Refer to accounts and contracts by their labels; the tools accept labels.',
  'A contract that is archived or has fewer than 30 days left needs attention: simulate extending it to the network maximum of 180 days (or restoring it when archived) and propose that, one action per contract.',
  'Never describe a fix you have not recorded with proposeAction: call it first, then report it.',
  'Report policy exactly as proposeAction returned it: "within policy", or "needs approval" because the cost is above the approval threshold or the operation is not allowed.',
  'A payment blocked by a missing trustline on one of our own accounts is fixed with sponsor_trustline: the sender sponsors the trustline, which locks 0.5 XLM of reserve. Propose it with that cost.',
].join('\n');

const account = z
  .string()
  .describe('An account label or role from getOrg (e.g. treasury), or its address');
const contract = z.string().describe('A contract label from getOrg (e.g. Escrow), or its id');

const simulationSource = (org: Org): string =>
  (org.accounts.find((a) => a.role === 'treasury') ?? org.accounts[0])?.address ?? '';

export const createAgentTools = (storage: Storage, clients: Clients) => {
  const resolve = async (ref: string) => resolveSubject(await storage.getOrg(), ref);
  const source = async () => simulationSource(await storage.getOrg());

  return {
    getOrg: tool({
      description:
        'Read-only. Returns the organisation this harness operates for: its name, network, accounts (address, label, role), contracts (id, label) and policy (daily spend limit, allowed operations, approval threshold in XLM). Call it first; every other tool works only on subjects it returns.',
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
