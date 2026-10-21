import {
  type ActiveContract,
  type ContractCheck,
  checkContracts,
  fetchXlmUsd,
  type LedgerTally,
  listActiveContracts,
  measureCloseSeconds,
  type Rpc,
  readLedgerRange,
  readMaxExtendLedgers,
} from '@harness/chain';
import * as live from '@harness/storage/live';
import type { Sql } from '@harness/storage/pg';
import type { Log } from './log';

export const TX_CURSOR = 'txs';
const DAY_SECONDS = 86_400;
const DAY_MS = DAY_SECONDS * 1000;
const SNAPSHOT_DELAY_MS = 5 * 60_000;
const WINDOW_LEDGERS = 20;
const PARALLEL_WINDOWS = 8;

export type Store = {
  readCursor(name: string): Promise<number | null>;
  writeLedgerBatch(tallies: LedgerTally[], cursor: { name: string; ledger: number }): Promise<void>;
  pruneLedgers(keepHours: number): Promise<number>;
  readActiveContracts(): Promise<{ rows: ActiveContract[]; refreshedAt: string | null }>;
  replaceActiveContracts(rows: ActiveContract[]): Promise<void>;
  replaceContracts(rows: ContractCheck[], meta: live.ContractsMeta): Promise<void>;
  readSummary(): Promise<live.LiveSummary>;
  readSnapshot(date: string): Promise<unknown | null>;
  writeDailySnapshot(date: string, json: unknown): Promise<void>;
};

export const sqlStore = (sql: Sql): Store => ({
  readCursor: (name) => live.readCursor(sql, name),
  writeLedgerBatch: (tallies, cursor) => live.writeLedgerBatch(sql, tallies, cursor),
  pruneLedgers: (keepHours) => live.pruneLedgers(sql, keepHours),
  readActiveContracts: () => live.readActiveContracts(sql),
  replaceActiveContracts: (rows) => live.replaceActiveContracts(sql, rows),
  replaceContracts: (rows, meta) => live.replaceContracts(sql, rows, meta),
  readSummary: () => live.readSummary(sql),
  readSnapshot: (date) => live.readSnapshot(sql, date),
  writeDailySnapshot: (date, json) => live.writeDailySnapshot(sql, date, json),
});

export type Deps = { rpc: Rpc; store: Store; log: Log; now?: () => Date };

type Range = { from: number; to: number };

export const resumeFrom = (cursor: number | null, oldestLedger: number): number | null =>
  cursor !== null && cursor + 1 >= oldestLedger ? cursor + 1 : null;

export const backfillFrom = (oldestLedger: number, latestLedger: number, closeSeconds: number) =>
  Math.max(oldestLedger, latestLedger - Math.ceil(DAY_SECONDS / closeSeconds));

const syncLedgers = async (
  { rpc, store }: Deps,
  range: Range,
  cursorName: string,
  opts: { signal?: AbortSignal; onBatch?: (ledger: number) => void } = {},
): Promise<{ ledgers: number; cursor: number | null }> => {
  let ledgers = 0;
  let cursor: number | null = null;
  const windows: Range[] = [];
  for (let from = range.from; from <= range.to; from += WINDOW_LEDGERS) {
    windows.push({ from, to: Math.min(range.to, from + WINDOW_LEDGERS - 1) });
  }
  // Windows are read in parallel but written in ledger order, so the cursor only moves forward.
  for (let index = 0; index < windows.length; index += PARALLEL_WINDOWS) {
    const group = await Promise.all(
      windows.slice(index, index + PARALLEL_WINDOWS).map(async (window) => {
        const tallies: LedgerTally[] = [];
        for await (const batch of readLedgerRange(rpc, window.from, window.to)) {
          tallies.push(...batch);
        }
        return tallies;
      }),
    );
    for (const tallies of group) {
      const last = tallies.at(-1);
      if (!last) continue;
      await store.writeLedgerBatch(tallies, { name: cursorName, ledger: last.ledger });
      ledgers += tallies.length;
      cursor = last.ledger;
      opts.onBatch?.(cursor);
    }
    if (opts.signal?.aborted) break;
  }
  return { ledgers, cursor };
};

export const catchUp = async (
  deps: Deps,
  opts: {
    signal?: AbortSignal;
    onLatest?: (ledger: number) => void;
    onBatch?: (ledger: number) => void;
  } = {},
): Promise<{ latestLedger: number; ledgers: number; cursor: number | null }> => {
  const latestLedger = await deps.rpc.latestLedger();
  opts.onLatest?.(latestLedger);
  const head = await deps.rpc.transactions({ startLedger: latestLedger, limit: 1 });
  const cursor = await deps.store.readCursor(TX_CURSOR);
  let from = resumeFrom(cursor, head.oldestLedger);
  if (from === null) {
    from = backfillFrom(head.oldestLedger, latestLedger, await measureCloseSeconds(deps.rpc));
    deps.log.info({ cursor, from, to: latestLedger }, 'backfilling the last 24 hours');
  }
  const result = await syncLedgers(deps, { from, to: latestLedger }, TX_CURSOR, opts);
  return { latestLedger, ...result };
};

const activeContracts = async (
  { store, log, now = () => new Date() }: Deps,
  fetchImpl?: typeof fetch,
): Promise<ActiveContract[]> => {
  const stored = await store.readActiveContracts();
  const age =
    stored.refreshedAt === null ? Infinity : now().getTime() - Date.parse(stored.refreshedAt);
  if (stored.rows.length > 0 && age < DAY_MS) return stored.rows;
  try {
    const rows = await listActiveContracts({ fetchImpl, log: (message) => log.info(message) });
    if (rows.length === 0) throw new Error('the active contract list came back empty');
    await store.replaceActiveContracts(rows);
    return rows;
  } catch (error) {
    if (stored.rows.length === 0) throw error;
    log.warn({ err: error }, 'active contract refresh failed, using the stored list');
    return stored.rows;
  }
};

export const runContracts = async (
  deps: Deps & { simulationSource: string; fetchImpl?: typeof fetch },
): Promise<live.ContractsMeta> => {
  const { rpc, log, now = () => new Date() } = deps;
  const active = await activeContracts(deps, deps.fetchImpl);
  const check = await checkContracts(rpc, active, { simulationSource: deps.simulationSource });
  if (check.rows.length === 0)
    throw new Error('no contract could be checked, keeping the stored results');
  const [price, maxExtend] = await Promise.all([
    fetchXlmUsd(deps.fetchImpl).catch((error: unknown) => {
      log.warn({ err: error }, 'XLM price fetch failed');
      return null;
    }),
    readMaxExtendLedgers(rpc),
  ]);
  const fixCostXlm = check.rows.reduce((sum, row) => sum + (row.fixCostXlm ?? 0), 0);
  const meta: live.ContractsMeta = {
    checkedAt: now().toISOString(),
    archived: check.rows.filter((row) => row.status === 'archived').length,
    expiring30d: check.rows.filter((row) => row.status === 'expiring').length,
    fixCostXlm,
    fixCostUsd: price ? fixCostXlm * price.price : null,
    simulated: check.simulated,
    simulationFailed: check.simulationFailed,
    xlmUsd: price?.price ?? null,
    priceSource: price?.source ?? null,
    priceTime: price?.time ?? null,
    extendDays: Math.round((maxExtend * check.closeSeconds) / DAY_SECONDS),
  };
  await deps.store.replaceContracts(check.rows, meta);
  log.info({ ...meta, checked: active.length }, 'contracts checked');
  return meta;
};

export const snapshotDate = (now: Date): string =>
  new Date(now.getTime() - SNAPSHOT_DELAY_MS - DAY_MS).toISOString().slice(0, 10);

export const writeSnapshotIfDue = async ({
  store,
  now = () => new Date(),
}: Pick<Deps, 'store' | 'now'>): Promise<string | null> => {
  const at = now();
  const date = snapshotDate(at);
  if ((await store.readSnapshot(date)) !== null) return null;
  const summary = await store.readSummary();
  if (summary.endLedger === null) return null;
  await store.writeDailySnapshot(date, { date, generatedAt: at.toISOString(), ...summary });
  return date;
};
