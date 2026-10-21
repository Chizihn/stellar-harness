import type { LedgerTally, Rpc, RpcTx } from '@harness/chain';
import type { ContractsMeta, LiveSummary } from '@harness/storage/live';
import pino from 'pino';
import type { Store } from './run';

export const silent = pino({ level: 'silent' });

const CLOSE_SECONDS = 5;

const tx = (ledger: number, n: number, failed = false): RpcTx => ({
  txHash: `${ledger}-${n}`,
  ledger,
  createdAt: ledger * CLOSE_SECONDS,
  status: failed ? 'FAILED' : 'SUCCESS',
  envelopeXdr: 'not-xdr',
  resultXdr: 'not-xdr',
});

export const ledgerTxs = (ledger: number, count: number, failed = 0): RpcTx[] =>
  Array.from({ length: count }, (_, n) => tx(ledger, n, n < failed));

export const fakeRpc = (chain: { txs: RpcTx[]; oldest: number; latest: number }) => {
  const visible = () =>
    chain.txs.filter((row) => row.ledger <= chain.latest).sort((a, b) => a.ledger - b.ledger);
  const rpc: Rpc = {
    latestLedger: async () => chain.latest,
    transactions: async ({ startLedger, cursor, limit = 200 }) => {
      if (!cursor && (startLedger ?? 0) < chain.oldest) throw new Error('start before oldest');
      const rows = visible();
      const start = cursor
        ? Number(cursor)
        : rows.findIndex((row) => row.ledger >= (startLedger ?? 0));
      const from = start < 0 ? rows.length : start;
      const page = rows.slice(from, from + limit);
      return {
        transactions: page,
        latestLedger: chain.latest,
        oldestLedger: chain.oldest,
        cursor: String(from + page.length),
      };
    },
    ledgers: async ({ startLedger }) =>
      startLedger <= chain.latest
        ? [{ sequence: startLedger, closeTime: startLedger * CLOSE_SECONDS }]
        : [],
    ledgerEntries: async () => {
      throw new Error('ledgerEntries is not faked');
    },
    simulate: async () => ({ error: 'simulate is not faked' }),
  };
  return rpc;
};

export const memoryStore = () => {
  const ledgers = new Map<number, LedgerTally>();
  const cursors = new Map<string, number>();
  const snapshots = new Map<string, unknown>();
  const written: number[] = [];
  const state = {
    ledgers,
    cursors,
    snapshots,
    written,
    active: {
      rows: [] as Awaited<ReturnType<Store['readActiveContracts']>>['rows'],
      refreshedAt: null as string | null,
    },
    contracts: null as ContractsMeta | null,
    replacedContracts: 0,
  };
  const summary = (): LiveSummary => {
    const rows = [...ledgers.values()];
    const sum = (pick: (row: LedgerTally) => number) => rows.reduce((n, row) => n + pick(row), 0);
    const seqs = rows.map((row) => row.ledger);
    return {
      total: sum((row) => row.total),
      failed: sum((row) => row.failed),
      preventable: 0,
      retryable: 0,
      outOfScope: sum((row) => row.failed),
      startLedger: seqs.length ? Math.min(...seqs) : null,
      endLedger: seqs.length ? Math.max(...seqs) : null,
      endCloseTime: null,
      contracts: state.contracts,
    };
  };
  const store: Store = {
    readCursor: async (name) => cursors.get(name) ?? null,
    writeLedgerBatch: async (tallies, cursor) => {
      for (const tally of tallies) {
        ledgers.set(tally.ledger, tally);
        written.push(tally.ledger);
      }
      cursors.set(cursor.name, cursor.ledger);
    },
    pruneLedgers: async () => 0,
    readActiveContracts: async () => state.active,
    replaceActiveContracts: async (rows) => {
      state.active = { rows, refreshedAt: new Date().toISOString() };
    },
    replaceContracts: async (_rows, meta) => {
      state.contracts = meta;
      state.replacedContracts += 1;
    },
    readSummary: async () => summary(),
    readSnapshot: async (date) => snapshots.get(date) ?? null,
    writeDailySnapshot: async (date, json) => {
      snapshots.set(date, json);
    },
  };
  return { store, state };
};
