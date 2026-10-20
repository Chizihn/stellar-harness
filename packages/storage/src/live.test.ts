import type { ContractCheck, FailedTx, LedgerTally } from '@harness/chain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ContractsMeta,
  pruneLedgers,
  readActiveContracts,
  readCodes,
  readContracts,
  readCursor,
  readRecentFailures,
  readSnapshot,
  readSummary,
  readTopAccounts,
  replaceActiveContracts,
  replaceContracts,
  writeDailySnapshot,
  writeLedgerBatch,
} from './live';
import { createSql, migrate, type Sql } from './pg';

const url = process.env.TEST_DATABASE_URL;

const BASE = Date.parse('2026-10-20T00:00:00Z');
const at = (hours: number) => new Date(BASE + hours * 3_600_000).toISOString();

const failure = (
  ledger: number,
  hours: number,
  n: number,
  code: string,
  bucket: FailedTx['bucket'],
  source: string,
): FailedTx => ({
  ledger,
  closeTime: at(hours),
  txHash: `${ledger}-${n}`,
  source,
  code,
  bucket,
});

const tally = (ledger: number, hours: number, failures: FailedTx[], total = 10): LedgerTally => {
  const codes = new Map<string, { code: string; bucket: FailedTx['bucket']; count: number }>();
  const accounts = new Map<
    string,
    { account: string; bucket: FailedTx['bucket']; count: number; dominantCode: string }
  >();
  for (const f of failures) {
    const c = codes.get(f.code) ?? { code: f.code, bucket: f.bucket, count: 0 };
    c.count += 1;
    codes.set(f.code, c);
    const key = `${f.source}|${f.bucket}`;
    const a = accounts.get(key) ?? {
      account: f.source,
      bucket: f.bucket,
      count: 0,
      dominantCode: f.code,
    };
    a.count += 1;
    accounts.set(key, a);
  }
  return {
    ledger,
    closeTime: at(hours),
    total,
    failed: failures.length,
    codes: [...codes.values()],
    accounts: [...accounts.values()],
    failures,
  };
};

const meta: ContractsMeta = {
  checkedAt: '2026-10-20T12:00:00.000Z',
  archived: 1,
  expiring30d: 1,
  fixCostXlm: 1.5,
  fixCostUsd: 0.27,
  simulated: 2,
  simulationFailed: 0,
  xlmUsd: 0.18,
  priceSource: 'coingecko:simple/price',
  priceTime: '2026-10-20T11:59:00.000Z',
  extendDays: 180,
};

describe.skipIf(!url)('live tables in postgres', () => {
  let sql: Sql;
  const schema = `test_live_${Date.now()}`;

  beforeAll(async () => {
    const admin = createSql(url as string);
    await admin.unsafe(`create schema ${schema}`);
    await admin.end();
    sql = createSql(`${url}${url?.includes('?') ? '&' : '?'}options=-c%20search_path%3D${schema}`);
  });

  afterAll(async () => {
    await sql.unsafe(`drop schema ${schema} cascade`);
    await sql.end();
  });

  it('migrates once and drops the old tables', async () => {
    expect(await migrate(sql)).toEqual(['0001_pilot_requests', '0002_report_files', '0003_live']);
    expect(await migrate(sql)).toEqual([]);
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = ${schema} order by 1
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      'active_contracts',
      'app_migrations',
      'contracts',
      'contracts_meta',
      'cursor',
      'daily_snapshots',
      'ledger_account_counts',
      'ledger_code_counts',
      'ledger_counts',
      'recent_failures',
    ]);
  });

  it('writes ledger batches idempotently with the cursor', async () => {
    expect(await readCursor(sql, 'txs')).toBeNull();
    const old = tally(100, 0, [failure(100, 0, 0, 'op_underfunded', 'preventable', 'GOLD')]);
    const batch = [
      tally(200, 20, [
        failure(200, 20, 0, 'op_underfunded', 'preventable', 'GA'),
        failure(200, 20, 1, 'op_underfunded', 'preventable', 'GA'),
        failure(200, 20, 2, 'tx_too_late', 'retryable', 'GA'),
      ]),
      tally(201, 30, [
        failure(201, 30, 0, 'op_over_source_max', 'retryable', 'GB'),
        failure(201, 30, 1, 'invoke_host_function_trapped', 'out_of_scope', 'GC'),
      ]),
    ];
    await writeLedgerBatch(sql, [old], { name: 'txs', ledger: 100 });
    await writeLedgerBatch(sql, batch, { name: 'txs', ledger: 201 });
    await writeLedgerBatch(sql, batch, { name: 'txs', ledger: 201 });
    expect(await readCursor(sql, 'txs')).toBe(201);

    const summary = await readSummary(sql);
    expect(summary).toEqual({
      total: 20,
      failed: 5,
      preventable: 2,
      retryable: 2,
      outOfScope: 1,
      startLedger: 200,
      endLedger: 201,
      endCloseTime: at(30),
      contracts: null,
    });
    expect(summary.preventable + summary.retryable + summary.outOfScope).toBe(summary.failed);

    expect(await readCodes(sql)).toEqual([
      { code: 'op_underfunded', bucket: 'preventable', count: 2 },
      { code: 'invoke_host_function_trapped', bucket: 'out_of_scope', count: 1 },
      { code: 'op_over_source_max', bucket: 'retryable', count: 1 },
      { code: 'tx_too_late', bucket: 'retryable', count: 1 },
    ]);
    expect(await readTopAccounts(sql, 10)).toEqual([
      { account: 'GA', preventable: 2, retryable: 1, dominantCode: 'op_underfunded' },
      { account: 'GB', preventable: 0, retryable: 1, dominantCode: 'op_over_source_max' },
    ]);
    const recent = await readRecentFailures(sql, 3);
    expect(recent.map((row) => row.txHash)).toEqual(['201-1', '201-0', '200-2']);
    expect(recent[0]).toEqual(
      failure(201, 30, 1, 'invoke_host_function_trapped', 'out_of_scope', 'GC'),
    );
  });

  it('trims recent failures to the newest 500', async () => {
    const many = Array.from({ length: 600 }, (_, n) =>
      failure(300, 31, n, 'op_no_trust', 'preventable', 'GD'),
    );
    await writeLedgerBatch(sql, [tally(300, 31, many, 600)], { name: 'txs', ledger: 300 });
    const [row] = await sql<{ n: string }[]>`select count(*) as n from recent_failures`;
    expect(Number(row?.n)).toBe(500);
    expect((await readRecentFailures(sql, 1))[0]?.txHash).toBe('300-599');
  });

  it('prunes ledgers older than the kept window', async () => {
    expect(await pruneLedgers(sql, 1)).toBe(3);
    expect((await readSummary(sql)).startLedger).toBe(300);
  });

  it('replaces active contracts and contract checks', async () => {
    await replaceActiveContracts(sql, [
      { contract: 'CA', invocations: 5, scfProject: 'Demo' },
      { contract: 'CB', invocations: 500, scfProject: null },
    ]);
    const active = await readActiveContracts(sql);
    expect(active.rows).toEqual([
      { contract: 'CB', invocations: 500, scfProject: null },
      { contract: 'CA', invocations: 5, scfProject: 'Demo' },
    ]);
    expect(active.refreshedAt).not.toBeNull();

    const rows: ContractCheck[] = [
      {
        contract: 'CA',
        status: 'archived',
        invocations: 5,
        liveUntilLedger: null,
        daysLeft: null,
        fixCostXlm: 1.25,
        scfProject: 'Demo',
      },
      {
        contract: 'CB',
        status: 'expiring',
        invocations: 500,
        liveUntilLedger: 1000,
        daysLeft: 12.5,
        fixCostXlm: null,
        scfProject: null,
      },
    ];
    await replaceContracts(sql, [rows[0] as ContractCheck], { ...meta, archived: 9 });
    await replaceContracts(sql, rows, meta);
    expect(await readContracts(sql, 'archived')).toEqual([rows[0]]);
    expect(await readContracts(sql, 'expiring')).toEqual([rows[1]]);
    expect((await readSummary(sql)).contracts).toEqual(meta);
  });

  it('stores daily snapshots by date', async () => {
    expect(await readSnapshot(sql, '2026-10-19')).toBeNull();
    await writeDailySnapshot(sql, '2026-10-19', { failed: 1 });
    await writeDailySnapshot(sql, '2026-10-19', { failed: 2, codes: ['op_no_trust'] });
    expect(await readSnapshot(sql, '2026-10-19')).toEqual({ failed: 2, codes: ['op_no_trust'] });
  });
});
