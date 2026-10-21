import type { Network } from '@harness/schema';
import { Networks, rpc } from '@stellar/stellar-sdk';

const ENDPOINTS: Record<Network, { horizon: string; rpc: string; passphrase: string }> = {
  testnet: {
    horizon: 'https://horizon-testnet.stellar.org',
    rpc: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    horizon: 'https://horizon.stellar.org',
    rpc: 'https://mainnet.sorobanrpc.com',
    passphrase: Networks.PUBLIC,
  },
};

export const SECONDS_PER_LEDGER = 5;
export const STROOPS_PER_XLM = 10_000_000;
export const BASE_RESERVE_XLM = 0.5;

export type Balance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  selling_liabilities?: string;
};

export type HorizonAccount = {
  sequence: string;
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  signers: { key: string; weight: number }[];
  balances: Balance[];
};

export type Clients = {
  network: Network;
  passphrase: string;
  loadAccount(address: string): Promise<HorizonAccount | null>;
  rpc: Pick<rpc.Server, 'getAccount' | 'getLedgerEntries' | 'simulateTransaction'>;
};

// The public RPC and Horizon sometimes stall for 10 s or more on one request; these reads are
// idempotent, so a stalled call is raced against a fresh one instead of waited out.
export const retryOnStall = async <T>(
  call: () => Promise<T>,
  stallMs = 3_000,
  attempts = 3,
): Promise<T> => {
  const pending: Promise<T>[] = [];
  for (let attempt = 1; ; attempt++) {
    pending.push(call());
    if (attempt === attempts) return Promise.race(pending);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<'stalled'>((resolve) => {
      timer = setTimeout(() => resolve('stalled'), stallMs);
    });
    const first = await Promise.race([...pending, stalled]).finally(() => clearTimeout(timer));
    if (first !== 'stalled') return first;
  }
};

export const createClients = (network: Network): Clients => {
  const endpoints = ENDPOINTS[network];
  const server = new rpc.Server(endpoints.rpc);
  return {
    network,
    passphrase: endpoints.passphrase,
    loadAccount: (address) =>
      retryOnStall(async () => {
        const response = await fetch(`${endpoints.horizon}/accounts/${address}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Horizon returned ${response.status} for ${address}`);
        return (await response.json()) as HorizonAccount;
      }),
    rpc: {
      getAccount: (address) => retryOnStall(() => server.getAccount(address)),
      getLedgerEntries: (...keys) => retryOnStall(() => server.getLedgerEntries(...keys)),
      simulateTransaction: (tx, addlResources) =>
        retryOnStall(() => server.simulateTransaction(tx, addlResources)),
    },
  };
};

export const stroopsToXlm = (stroops: number): number => stroops / STROOPS_PER_XLM;
