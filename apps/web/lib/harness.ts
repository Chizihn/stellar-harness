import 'server-only';
import { createAgentTools, type MainnetReport } from '@harness/agent';
import type { Action, Org, OrgAccount, OrgContract } from '@harness/schema';
import {
  buildPaymentPreflight,
  type ContractTtl,
  createClients,
  getAccount,
  getContractTtl,
  simulateExtendTtl,
  simulateRestore,
} from '@harness/stellar-tools';
import { MemoryStorage } from '@harness/storage';
import { DEMO_ORG } from '@/demo-org';
import { ttlCache } from './memo';
import { SEED_EVERY_MS, type SeedReads, seedActions } from './seed-actions';

export const ORG: Org = DEMO_ORG;

const globals = globalThis as typeof globalThis & { harnessStorage?: MemoryStorage };
globals.harnessStorage ??= new MemoryStorage(ORG);
const storage = globals.harnessStorage;
const clients = createClients(ORG.network);
const treasury = ORG.accounts.find((account) => account.role === 'treasury')?.address ?? '';

const readMainnetReport = async (): Promise<MainnetReport> => {
  throw new Error('The mainnet report is not connected yet.');
};

export const tools = createAgentTools(storage, clients, { readMainnetReport });

type WatchedAccount = OrgAccount & { xlm: string | null };
export type WatchedContract = OrgContract & { ttl: ContractTtl | null };
export type Watch = {
  accounts: WatchedAccount[];
  contracts: WatchedContract[];
  actions: Action[];
};

const settle = <T>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

const liveCache = ttlCache<Pick<Watch, 'accounts' | 'contracts'>>(30_000);

const readAccountsAndContracts = async () => ({
  accounts: await Promise.all(
    ORG.accounts.map(async (account) => ({
      ...account,
      xlm: (await settle(getAccount(clients, account.address)))?.xlm ?? null,
    })),
  ),
  contracts: await Promise.all(
    ORG.contracts.map(async (contract) => ({
      ...contract,
      ttl: await settle(getContractTtl(clients, contract.id)),
    })),
  ),
});

const seedReads: SeedReads = {
  getContractTtl: (contractId) => getContractTtl(clients, contractId),
  simulateExtendTtl: (contractId, days) =>
    simulateExtendTtl(clients, { contractId, days, source: treasury }),
  simulateRestore: (contractId) => simulateRestore(clients, { contractId, source: treasury }),
  buildPaymentPreflight: (from, to, asset) =>
    buildPaymentPreflight(clients, { from, to, asset, amount: 1 }),
};

const seedCache = ttlCache<void>(SEED_EVERY_MS);

export const readWatch = async (): Promise<Watch> => {
  const [live] = await Promise.all([
    liveCache.get(readAccountsAndContracts),
    seedCache.get(() => seedActions(storage, seedReads)),
  ]);
  return { ...live, actions: await storage.listActions() };
};
