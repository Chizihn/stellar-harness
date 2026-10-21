import { describe, expect, it } from 'vitest';
import {
  backfillFrom,
  catchUp,
  resumeFrom,
  runContracts,
  snapshotDate,
  TX_CURSOR,
  writeSnapshotIfDue,
} from './run';
import { fakeRpc, ledgerTxs, memoryStore, silent } from './testing';

const DAY_LEDGERS = 86_400 / 5;

describe('start ledger', () => {
  it('resumes right after a cursor the RPC still holds', () => {
    expect(resumeFrom(500, 400)).toBe(501);
    expect(resumeFrom(399, 400)).toBe(400);
  });

  it('backfills when the cursor is missing or older than retention', () => {
    expect(resumeFrom(null, 400)).toBeNull();
    expect(resumeFrom(398, 400)).toBeNull();
    expect(backfillFrom(100, 100_000, 5)).toBe(100_000 - DAY_LEDGERS);
    expect(backfillFrom(90_000, 100_000, 5)).toBe(90_000);
  });
});

describe('catchUp', () => {
  it('backfills the last 24 hours of ledgers when there is no cursor', async () => {
    const latest = 50_000;
    const chain = {
      oldest: 1,
      latest,
      txs: [latest - DAY_LEDGERS - 1, latest - DAY_LEDGERS, latest].flatMap((l) => ledgerTxs(l, 2)),
    };
    const { store, state } = memoryStore();
    const result = await catchUp({ rpc: fakeRpc(chain), store, log: silent });
    expect(state.written).toEqual([latest - DAY_LEDGERS, latest]);
    expect(result).toEqual({ latestLedger: latest, ledgers: 2, cursor: latest });
    expect(state.cursors.get(TX_CURSOR)).toBe(latest);
  });

  it('never counts a ledger twice or skips one across restarts', async () => {
    const chain = {
      oldest: 100,
      latest: 110,
      txs: [
        ...ledgerTxs(100, 3, 1),
        ...ledgerTxs(103, 250, 7),
        ...ledgerTxs(110, 150),
        ...ledgerTxs(111, 180, 2),
        ...ledgerTxs(112, 420, 9),
        ...ledgerTxs(118, 1),
      ],
    };
    const { store, state } = memoryStore();
    const rpc = fakeRpc(chain);
    await catchUp({ rpc, store, log: silent });
    expect(state.cursors.get(TX_CURSOR)).toBe(110);
    await catchUp({ rpc, store, log: silent });
    chain.latest = 120;
    await catchUp({ rpc, store, log: silent });

    expect(state.written).toEqual([100, 103, 110, 111, 112, 118]);
    const summary = await store.readSummary();
    expect(summary.total).toBe(chain.txs.length);
    expect(summary.failed).toBe(19);
    expect(state.cursors.get(TX_CURSOR)).toBe(118);
  });

  it('stops between batches when aborted and resumes from the cursor', async () => {
    const chain = {
      oldest: 1,
      latest: 500,
      txs: [1, 150, 200, 499].flatMap((l) => ledgerTxs(l, 3)),
    };
    const { store, state } = memoryStore();
    const stop = new AbortController();
    await catchUp(
      { rpc: fakeRpc(chain), store, log: silent },
      { signal: stop.signal, onBatch: () => stop.abort() },
    );
    expect(state.written).toEqual([1, 150]);
    await catchUp({ rpc: fakeRpc(chain), store, log: silent });
    expect(state.written).toEqual([1, 150, 200, 499]);
  });
});

describe('daily snapshot', () => {
  it('targets yesterday from 00:05 UTC', () => {
    expect(snapshotDate(new Date('2026-10-21T00:04:59Z'))).toBe('2026-10-19');
    expect(snapshotDate(new Date('2026-10-21T00:05:00Z'))).toBe('2026-10-20');
    expect(snapshotDate(new Date('2026-10-21T23:59:00Z'))).toBe('2026-10-20');
  });

  it('writes once per day and catches up after downtime', async () => {
    const { store, state } = memoryStore();
    const now = () => new Date('2026-10-21T09:30:00Z');
    expect(await writeSnapshotIfDue({ store, now })).toBeNull();
    await store.writeLedgerBatch(
      [
        {
          ledger: 7,
          closeTime: '2026-10-21T09:29:00Z',
          total: 4,
          failed: 1,
          codes: [],
          accounts: [],
          failures: [],
        },
      ],
      { name: TX_CURSOR, ledger: 7 },
    );
    expect(await writeSnapshotIfDue({ store, now })).toBe('2026-10-20');
    expect(await writeSnapshotIfDue({ store, now })).toBeNull();
    expect(state.snapshots.get('2026-10-20')).toMatchObject({ date: '2026-10-20', total: 4 });
  });
});

describe('runContracts', () => {
  it('keeps the stored results when the run fails', async () => {
    const { store, state } = memoryStore();
    state.active = {
      rows: [{ contract: 'C1', invocations: 500, scfProject: null }],
      refreshedAt: '2026-10-01T00:00:00.000Z',
    };
    const failing = (async () => new Response(null, { status: 404 })) as typeof fetch;
    await expect(
      runContracts({
        rpc: fakeRpc({ oldest: 1, latest: 1000, txs: [] }),
        store,
        log: silent,
        simulationSource: 'G',
        fetchImpl: failing,
      }),
    ).rejects.toThrow();
    expect(state.replacedContracts).toBe(0);
    expect(state.active.rows).toHaveLength(1);
  });
});
