import 'server-only';
import type { MainnetReport } from '@harness/agent';
import { type Bucket, type ContractCheck, classify, type FailedTx } from '@harness/chain';
import {
  type LiveSummary,
  readCodes,
  readContracts,
  readRecentFailures,
  readSnapshot,
  readSummary,
  readTopAccounts,
} from '@harness/storage/live';
import { db } from './db';
import {
  type CodeRow,
  type CodesPayload,
  type ContractStatus,
  type ContractsPayload,
  FEED_SIZE,
  type RecentPayload,
  type SnapshotPayload,
  type SummaryPayload,
  type TopAccount,
  type TopAccountsPayload,
} from './live-schemas';

export const PUBLIC_API = {
  cors: true,
  cacheControl: 'public, max-age=15',
  rateLimit: { limit: 120, windowSeconds: 60 },
} as const;

type Window = Pick<SummaryPayload, 'generatedAt' | 'startLedger' | 'endLedger'>;

export type WhatFailedRow = CodeRow & { grouped: string[] };

const TOP_CODES = 10;
const TOP_ACCOUNTS = 25;

const windowOf = (summary: LiveSummary, now: Date): Window => ({
  generatedAt: now.toISOString(),
  startLedger: summary.startLedger,
  endLedger: summary.endLedger,
});

const ratio = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : 0;

export const buildSummary = (summary: LiveSummary, now: Date): SummaryPayload => ({
  ...windowOf(summary, now),
  total: summary.total,
  failed: summary.failed,
  preventable: summary.preventable,
  retryable: summary.retryable,
  outOfScope: summary.outOfScope,
  endCloseTime: summary.endCloseTime,
  lagSeconds: summary.endCloseTime
    ? Math.max(0, Math.round((now.getTime() - Date.parse(summary.endCloseTime)) / 1000))
    : null,
  contracts: summary.contracts,
});

export const buildCodes = (
  rows: { code: string; bucket: Bucket; count: number }[],
  window: Window,
): CodesPayload => {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const codes = rows
    .map((row) => {
      const info = classify(row.code);
      return {
        code: row.code,
        bucket: row.bucket,
        count: row.count,
        share: ratio(row.count, total),
        fix: info.fix,
        plain: info.plain,
      };
    })
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return { ...window, codes };
};

export const OTHER_PLAIN = 'Failures the harness does not act on, grouped into one row.';

export const whatFailedRows = (codes: CodeRow[]): WhatFailedRow[] => {
  const known = codes
    .filter((row) => row.bucket !== 'out_of_scope')
    .map((row) => ({ ...row, grouped: [] }));
  const other = codes.filter((row) => row.bucket === 'out_of_scope');
  if (other.length === 0) return known;
  return [
    ...known,
    {
      code: 'other',
      bucket: 'out_of_scope',
      count: other.reduce((sum, row) => sum + row.count, 0),
      share: Math.round(other.reduce((sum, row) => sum + row.share, 0) * 10_000) / 10_000,
      fix: null,
      plain: OTHER_PLAIN,
      grouped: other.map((row) => row.code),
    },
  ];
};

export const buildRecent = (rows: FailedTx[], window: Window): RecentPayload => ({
  ...window,
  failures: rows.map((row) => ({
    ledger: row.ledger,
    time: row.closeTime,
    txHash: row.txHash,
    source: row.source,
    code: row.code,
    bucket: row.bucket,
  })),
});

export const buildTopAccounts = (rows: TopAccount[], window: Window): TopAccountsPayload => ({
  ...window,
  accounts: rows,
});

export const buildContracts = (
  rows: ContractCheck[],
  status: ContractStatus,
  checkedAt: string | null,
  window: Window,
): ContractsPayload => ({
  ...window,
  status,
  checkedAt,
  contracts: rows.map((row) => ({
    contract: row.contract,
    invocations: row.invocations,
    liveUntilLedger: row.liveUntilLedger,
    daysLeft: row.daysLeft,
    fixCostXlm: row.fixCostXlm,
  })),
});

const ledgerField = (value: unknown, key: 'startLedger' | 'endLedger'): number | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === 'number') return direct;
  return 'summary' in record ? ledgerField(record.summary, key) : null;
};

export const buildSnapshot = (date: string, snapshot: unknown, now: Date): SnapshotPayload => ({
  generatedAt: now.toISOString(),
  startLedger: ledgerField(snapshot, 'startLedger'),
  endLedger: ledgerField(snapshot, 'endLedger'),
  date,
  snapshot,
});

export const buildMainnetReport = (
  summary: SummaryPayload,
  codes: CodesPayload,
): MainnetReport => ({
  summary: {
    total: summary.total,
    failed: summary.failed,
    preventable: summary.preventable,
    retryable: summary.retryable,
    outOfScope: summary.outOfScope,
    startLedger: summary.startLedger,
    endLedger: summary.endLedger,
    contracts: summary.contracts && {
      archived: summary.contracts.archived,
      expiring30d: summary.contracts.expiring30d,
      fixCostXlm: summary.contracts.fixCostXlm,
      fixCostUsd: summary.contracts.fixCostUsd,
      extendDays: summary.contracts.extendDays,
    },
  },
  topCodes: codes.codes
    .slice(0, TOP_CODES)
    .map(({ code, bucket, count, share, fix }) => ({ code, bucket, count, share, fix })),
});

const withSummary = async <T>(
  read: (sql: Awaited<ReturnType<typeof db>>) => Promise<T>,
): Promise<[LiveSummary, T, Date]> => {
  const sql = await db();
  const [summary, value] = await Promise.all([readSummary(sql), read(sql)]);
  return [summary, value, new Date()];
};

export const getSummary = async (): Promise<SummaryPayload> =>
  buildSummary(await readSummary(await db()), new Date());

export const getCodes = async (): Promise<CodesPayload> => {
  const [summary, rows, now] = await withSummary(readCodes);
  return buildCodes(rows, windowOf(summary, now));
};

export const getRecent = async (limit: number): Promise<RecentPayload> => {
  const [summary, rows, now] = await withSummary((sql) => readRecentFailures(sql, limit));
  return buildRecent(rows, windowOf(summary, now));
};

export const getTopAccounts = async (limit: number): Promise<TopAccountsPayload> => {
  const [summary, rows, now] = await withSummary((sql) => readTopAccounts(sql, limit));
  return buildTopAccounts(rows, windowOf(summary, now));
};

export const getContracts = async (status: ContractStatus): Promise<ContractsPayload> => {
  const [summary, rows, now] = await withSummary((sql) => readContracts(sql, status));
  return buildContracts(rows, status, summary.contracts?.checkedAt ?? null, windowOf(summary, now));
};

export const getSnapshot = async (date: string): Promise<SnapshotPayload | null> => {
  const snapshot = await readSnapshot(await db(), date);
  return snapshot === null ? null : buildSnapshot(date, snapshot, new Date());
};

export const getMainnetReport = async (): Promise<MainnetReport> => {
  const sql = await db();
  const [summary, codes] = await Promise.all([readSummary(sql), readCodes(sql)]);
  const now = new Date();
  return buildMainnetReport(buildSummary(summary, now), buildCodes(codes, windowOf(summary, now)));
};

export const getReport = async () => {
  const sql = await db();
  const [summary, codes, recent, accounts, archived, expiring] = await Promise.all([
    readSummary(sql),
    readCodes(sql),
    readRecentFailures(sql, FEED_SIZE),
    readTopAccounts(sql, TOP_ACCOUNTS),
    readContracts(sql, 'archived'),
    readContracts(sql, 'expiring'),
  ]);
  const now = new Date();
  const window = windowOf(summary, now);
  const checkedAt = summary.contracts?.checkedAt ?? null;
  return {
    summary: buildSummary(summary, now),
    whatFailed: whatFailedRows(buildCodes(codes, window).codes),
    recent: buildRecent(recent, window),
    accounts: buildTopAccounts(accounts, window).accounts,
    archived: buildContracts(archived, 'archived', checkedAt, window).contracts,
    expiring: buildContracts(expiring, 'expiring', checkedAt, window).contracts,
  };
};
