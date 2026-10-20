import type { ActiveContract, Bucket, ContractCheck, FailedTx, LedgerTally } from '@harness/chain';
import type postgres from 'postgres';
import type { Sql } from './pg';

export type ContractsMeta = {
  checkedAt: string;
  archived: number;
  expiring30d: number;
  fixCostXlm: number;
  fixCostUsd: number | null;
  simulated: number;
  simulationFailed: number;
  xlmUsd: number | null;
  priceSource: string | null;
  priceTime: string | null;
  extendDays: number;
};

export type LiveSummary = {
  total: number;
  failed: number;
  preventable: number;
  retryable: number;
  outOfScope: number;
  startLedger: number | null;
  endLedger: number | null;
  endCloseTime: string | null;
  contracts: ContractsMeta | null;
};

const RECENT_FAILURES_KEPT = 500;
const INSERT_CHUNK = 2000;

type Tx = postgres.TransactionSql;
type Row = Record<string, string | number | Date | null>;

const num = (value: unknown): number => Number(value ?? 0);
const numOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);
const iso = (value: Date | string): string => new Date(value).toISOString();
const isoOrNull = (value: Date | string | null): string | null =>
  value === null ? null : iso(value);

const insertAll = async (tx: Tx | Sql, table: string, rows: Row[]): Promise<void> => {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    await tx`insert into ${tx(table)} ${tx(rows.slice(index, index + INSERT_CHUNK))}`;
  }
};

export const readCursor = async (sql: Sql, name: string): Promise<number | null> => {
  const [row] = await sql<{ ledger: string }[]>`select ledger from cursor where name = ${name}`;
  return row ? Number(row.ledger) : null;
};

export const writeLedgerBatch = async (
  sql: Sql,
  tallies: LedgerTally[],
  cursor: { name: string; ledger: number },
): Promise<void> => {
  const ledgers = tallies.map((tally) => tally.ledger);
  await sql.begin(async (tx) => {
    if (ledgers.length > 0) {
      for (const table of [
        'ledger_counts',
        'ledger_code_counts',
        'ledger_account_counts',
        'recent_failures',
      ]) {
        await tx`delete from ${tx(table)} where ledger = any(${ledgers}::bigint[])`;
      }
      await insertAll(
        tx,
        'ledger_counts',
        tallies.map((t) => ({
          ledger: t.ledger,
          close_time: t.closeTime,
          total: t.total,
          failed: t.failed,
        })),
      );
      await insertAll(
        tx,
        'ledger_code_counts',
        tallies.flatMap((t) =>
          t.codes.map((c) => ({
            ledger: t.ledger,
            code: c.code,
            bucket: c.bucket,
            count: c.count,
          })),
        ),
      );
      await insertAll(
        tx,
        'ledger_account_counts',
        tallies.flatMap((t) =>
          t.accounts.map((a) => ({
            ledger: t.ledger,
            account: a.account,
            bucket: a.bucket,
            count: a.count,
            dominant_code: a.dominantCode,
          })),
        ),
      );
      const newest = tallies
        .flatMap((t) => t.failures)
        .sort((a, b) => a.ledger - b.ledger)
        .slice(-RECENT_FAILURES_KEPT);
      await insertAll(
        tx,
        'recent_failures',
        newest.map((f) => ({
          ledger: f.ledger,
          close_time: f.closeTime,
          tx_hash: f.txHash,
          source: f.source,
          code: f.code,
          bucket: f.bucket,
        })),
      );
      await tx`
        delete from recent_failures where id not in (
          select id from recent_failures order by ledger desc, id desc limit ${RECENT_FAILURES_KEPT}
        )
      `;
    }
    await tx`
      insert into cursor (name, ledger, updated_at) values (${cursor.name}, ${cursor.ledger}, now())
      on conflict (name) do update set ledger = excluded.ledger, updated_at = excluded.updated_at
    `;
  });
};

export const pruneLedgers = async (sql: Sql, keepHours = 48): Promise<number> =>
  sql.begin(async (tx) => {
    const [cut] = await tx<{ ledger: string | null }[]>`
      select min(ledger) as ledger from ledger_counts
      where close_time > (select max(close_time) from ledger_counts) - make_interval(hours => ${keepHours})
    `;
    if (!cut?.ledger) return 0;
    const removed = await tx`delete from ledger_counts where ledger < ${cut.ledger}`;
    await tx`delete from ledger_code_counts where ledger < ${cut.ledger}`;
    await tx`delete from ledger_account_counts where ledger < ${cut.ledger}`;
    return removed.count;
  });

export const replaceActiveContracts = async (sql: Sql, rows: ActiveContract[]): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`delete from active_contracts`;
    await insertAll(
      tx,
      'active_contracts',
      rows.map((row) => ({
        contract: row.contract,
        invocations: row.invocations,
        scf_project: row.scfProject,
      })),
    );
  });
};

export const readActiveContracts = async (
  sql: Sql,
): Promise<{ rows: ActiveContract[]; refreshedAt: string | null }> => {
  const rows = await sql<
    { contract: string; invocations: number; scf_project: string | null; refreshed_at: Date }[]
  >`select contract, invocations, scf_project, refreshed_at from active_contracts order by invocations desc, contract`;
  const newest = rows.reduce<Date | null>(
    (max, row) => (max === null || row.refreshed_at > max ? row.refreshed_at : max),
    null,
  );
  return {
    rows: rows.map((row) => ({
      contract: row.contract,
      invocations: row.invocations,
      scfProject: row.scf_project,
    })),
    refreshedAt: isoOrNull(newest),
  };
};

export const replaceContracts = async (
  sql: Sql,
  rows: ContractCheck[],
  meta: ContractsMeta,
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`delete from contracts`;
    await insertAll(
      tx,
      'contracts',
      rows.map((row) => ({
        contract: row.contract,
        status: row.status,
        invocations: row.invocations,
        live_until_ledger: row.liveUntilLedger,
        days_left: row.daysLeft,
        fix_cost_xlm: row.fixCostXlm,
        scf_project: row.scfProject,
        checked_at: meta.checkedAt,
      })),
    );
    await tx`delete from contracts_meta`;
    await insertAll(tx, 'contracts_meta', [
      {
        checked_at: meta.checkedAt,
        archived: meta.archived,
        expiring30d: meta.expiring30d,
        fix_cost_xlm: meta.fixCostXlm,
        fix_cost_usd: meta.fixCostUsd,
        simulated: meta.simulated,
        simulation_failed: meta.simulationFailed,
        xlm_usd: meta.xlmUsd,
        price_source: meta.priceSource,
        price_time: meta.priceTime,
        extend_days: meta.extendDays,
      },
    ]);
  });
};

export const writeDailySnapshot = async (sql: Sql, date: string, json: unknown): Promise<void> => {
  const value = sql.json(json as postgres.JSONValue);
  await sql`
    insert into daily_snapshots (date, json) values (${date}, ${value})
    on conflict (date) do update set json = excluded.json
  `;
};

export const readSnapshot = async (sql: Sql, date: string): Promise<unknown | null> => {
  const [row] = await sql<
    { json: unknown }[]
  >`select json from daily_snapshots where date = ${date}`;
  return row ? row.json : null;
};

type MetaRow = {
  checked_at: Date;
  archived: number;
  expiring30d: number;
  fix_cost_xlm: string;
  fix_cost_usd: string | null;
  simulated: number;
  simulation_failed: number;
  xlm_usd: string | null;
  price_source: string | null;
  price_time: Date | null;
  extend_days: number;
};

const readMeta = async (sql: Sql): Promise<ContractsMeta | null> => {
  const [row] = await sql<MetaRow[]>`select * from contracts_meta order by checked_at desc limit 1`;
  if (!row) return null;
  return {
    checkedAt: iso(row.checked_at),
    archived: row.archived,
    expiring30d: row.expiring30d,
    fixCostXlm: num(row.fix_cost_xlm),
    fixCostUsd: numOrNull(row.fix_cost_usd),
    simulated: row.simulated,
    simulationFailed: row.simulation_failed,
    xlmUsd: numOrNull(row.xlm_usd),
    priceSource: row.price_source,
    priceTime: isoOrNull(row.price_time),
    extendDays: row.extend_days,
  };
};

const windowStart = (sql: Sql) => sql`
  (select coalesce(min(ledger), 0) from ledger_counts
   where close_time > (select max(close_time) from ledger_counts) - interval '24 hours')
`;

export const readSummary = async (sql: Sql): Promise<LiveSummary> => {
  const [ledgers] = await sql<
    {
      total: string | null;
      failed: string | null;
      start: string | null;
      end: string | null;
      end_time: Date | null;
    }[]
  >`
    select sum(total) as total, sum(failed) as failed, min(ledger) as start, max(ledger) as end,
           max(close_time) as end_time
    from ledger_counts where ledger >= ${windowStart(sql)}
  `;
  const buckets = await sql<{ bucket: Bucket; count: string }[]>`
    select bucket, sum(count) as count from ledger_code_counts where ledger >= ${windowStart(sql)} group by bucket
  `;
  const byBucket = (bucket: Bucket) => num(buckets.find((row) => row.bucket === bucket)?.count);
  return {
    total: num(ledgers?.total),
    failed: num(ledgers?.failed),
    preventable: byBucket('preventable'),
    retryable: byBucket('retryable'),
    outOfScope: byBucket('out_of_scope'),
    startLedger: numOrNull(ledgers?.start),
    endLedger: numOrNull(ledgers?.end),
    endCloseTime: isoOrNull(ledgers?.end_time ?? null),
    contracts: await readMeta(sql),
  };
};

export const readCodes = async (
  sql: Sql,
): Promise<{ code: string; bucket: Bucket; count: number }[]> => {
  const rows = await sql<{ code: string; bucket: Bucket; count: string }[]>`
    select code, min(bucket) as bucket, sum(count) as count from ledger_code_counts
    where ledger >= ${windowStart(sql)}
    group by code order by sum(count) desc, code
  `;
  return rows.map((row) => ({ code: row.code, bucket: row.bucket, count: num(row.count) }));
};

export const readRecentFailures = async (sql: Sql, limit: number): Promise<FailedTx[]> => {
  const rows = await sql<
    {
      ledger: string;
      close_time: Date;
      tx_hash: string;
      source: string;
      code: string;
      bucket: Bucket;
    }[]
  >`
    select ledger, close_time, tx_hash, source, code, bucket from recent_failures
    order by ledger desc, id desc limit ${limit}
  `;
  return rows.map((row) => ({
    ledger: num(row.ledger),
    closeTime: iso(row.close_time),
    txHash: row.tx_hash,
    source: row.source,
    code: row.code,
    bucket: row.bucket,
  }));
};

export const readTopAccounts = async (
  sql: Sql,
  limit: number,
): Promise<{ account: string; preventable: number; retryable: number; dominantCode: string }[]> => {
  const rows = await sql<
    { account: string; preventable: string; retryable: string; dominant_code: string }[]
  >`
    with fixable as (
      select account, bucket, count, dominant_code from ledger_account_counts
      where ledger >= ${windowStart(sql)} and bucket in ('preventable', 'retryable')
    ),
    totals as (
      select account,
             coalesce(sum(count) filter (where bucket = 'preventable'), 0) as preventable,
             coalesce(sum(count) filter (where bucket = 'retryable'), 0) as retryable
      from fixable group by account
    ),
    dominant as (
      select distinct on (account) account, dominant_code
      from (select account, dominant_code, sum(count) as n from fixable group by 1, 2) codes
      order by account, n desc, dominant_code
    )
    select t.account, t.preventable, t.retryable, d.dominant_code
    from totals t join dominant d using (account)
    order by t.preventable + t.retryable desc, t.account
    limit ${limit}
  `;
  return rows.map((row) => ({
    account: row.account,
    preventable: num(row.preventable),
    retryable: num(row.retryable),
    dominantCode: row.dominant_code,
  }));
};

export const readContracts = async (
  sql: Sql,
  status: 'archived' | 'expiring',
): Promise<ContractCheck[]> => {
  const rows = await sql<
    {
      contract: string;
      status: 'archived' | 'expiring';
      invocations: number;
      live_until_ledger: string | null;
      days_left: string | null;
      fix_cost_xlm: string | null;
      scf_project: string | null;
    }[]
  >`
    select contract, status, invocations, live_until_ledger, days_left, fix_cost_xlm, scf_project
    from contracts where status = ${status}
    order by invocations desc, contract
  `;
  return rows.map((row) => ({
    contract: row.contract,
    status: row.status,
    invocations: row.invocations,
    liveUntilLedger: numOrNull(row.live_until_ledger),
    daysLeft: numOrNull(row.days_left),
    fixCostXlm: numOrNull(row.fix_cost_xlm),
    scfProject: row.scf_project,
  }));
};
