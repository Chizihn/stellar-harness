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

export const createClients = (network: Network): Clients => {
  const endpoints = ENDPOINTS[network];
  return {
    network,
    passphrase: endpoints.passphrase,
    loadAccount: async (address) => {
      const response = await fetch(`${endpoints.horizon}/accounts/${address}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Horizon returned ${response.status} for ${address}`);
      return (await response.json()) as HorizonAccount;
    },
    rpc: new rpc.Server(endpoints.rpc),
  };
};

export const stroopsToXlm = (stroops: number): number => stroops / STROOPS_PER_XLM;
