import { z } from 'zod';
import { fetchWithRetry, HttpError, type RetryOptions } from './http';

export const DEFAULT_RPC_URL = 'https://mainnet.sorobanrpc.com';

export type RpcTx = {
  txHash: string;
  ledger: number;
  createdAt: number;
  status: string;
  envelopeXdr: string;
  resultXdr: string;
  feeBump?: boolean;
};

export type Rpc = {
  latestLedger(): Promise<number>;
  transactions(args: { startLedger?: number; cursor?: string; limit?: number }): Promise<{
    transactions: RpcTx[];
    latestLedger: number;
    oldestLedger: number;
    cursor: string;
  }>;
  ledgers(args: {
    startLedger: number;
    limit?: number;
  }): Promise<{ sequence: number; closeTime: number }[]>;
  ledgerEntries(
    keysXdr: string[],
  ): Promise<{ key: string; liveUntilLedgerSeq?: number; xdr: string }[]>;
  simulate(txXdr: string): Promise<{ minResourceFee?: string; error?: string }>;
};

const num = z.coerce.number().int();

const Envelope = z.object({
  error: z.object({ code: z.number(), message: z.string() }).optional(),
  result: z.unknown().optional(),
});

const LatestLedger = z.object({ sequence: num });

const Transactions = z.object({
  transactions: z
    .array(
      z.object({
        txHash: z.string(),
        ledger: num,
        createdAt: num,
        status: z.string(),
        envelopeXdr: z.string(),
        resultXdr: z.string(),
        feeBump: z.boolean().optional(),
      }),
    )
    .nullable()
    .transform((rows) => rows ?? []),
  latestLedger: num,
  oldestLedger: num,
  cursor: z.string(),
});

const Ledgers = z.object({
  ledgers: z
    .array(z.object({ sequence: num, ledgerCloseTime: num }))
    .nullable()
    .transform((rows) => rows ?? []),
});

const LedgerEntries = z.object({
  entries: z
    .array(z.object({ key: z.string(), xdr: z.string(), liveUntilLedgerSeq: num.optional() }))
    .nullable()
    .optional()
    .transform((rows) => rows ?? []),
});

const Simulation = z.object({
  minResourceFee: z.string().optional(),
  error: z.string().optional(),
});

export const createRpc = (
  url: string,
  fetchImpl: typeof fetch = fetch,
  options: RetryOptions = {},
): Rpc => {
  let id = 0;

  const call = async <T>(method: string, params: unknown, schema: z.ZodType<T>): Promise<T> => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params });
    const response = await fetchWithRetry(
      fetchImpl,
      url,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body },
      options,
    );
    if (!response.ok)
      throw new HttpError(`${method} returned HTTP ${response.status}`, response.status);
    const parsed = Envelope.parse(await response.json());
    if (parsed.error) throw new HttpError(`${method}: ${parsed.error.message}`);
    return schema.parse(parsed.result);
  };

  return {
    latestLedger: async () => (await call('getLatestLedger', undefined, LatestLedger)).sequence,
    transactions: ({ startLedger, cursor, limit = 200 }) =>
      call(
        'getTransactions',
        {
          ...(cursor ? {} : { startLedger }),
          pagination: { limit, ...(cursor ? { cursor } : {}) },
          xdrFormat: 'base64',
        },
        Transactions,
      ),
    ledgers: async ({ startLedger, limit = 1 }) =>
      (
        await call(
          'getLedgers',
          { startLedger, pagination: { limit }, xdrFormat: 'base64' },
          Ledgers,
        )
      ).ledgers.map((ledger) => ({ sequence: ledger.sequence, closeTime: ledger.ledgerCloseTime })),
    ledgerEntries: async (keys) =>
      (await call('getLedgerEntries', { keys, xdrFormat: 'base64' }, LedgerEntries)).entries,
    simulate: (transaction) => call('simulateTransaction', { transaction }, Simulation),
  };
};
