import { readCursor, readSummary } from '@harness/storage/live';
import { createSql, migrate, type Sql } from '@harness/storage/pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catchUp, sqlStore, TX_CURSOR } from './run';
import { fakeRpc, ledgerTxs, silent } from './testing';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('worker against postgres', () => {
  let sql: Sql;
  const schema = `test_worker_${Date.now()}`;

  beforeAll(async () => {
    const admin = createSql(url as string);
    await admin.unsafe(`create schema ${schema}`);
    await admin.end();
    sql = createSql(`${url}${url?.includes('?') ? '&' : '?'}options=-c%20search_path%3D${schema}`);
    await migrate(sql);
  });

  afterAll(async () => {
    await sql.unsafe(`drop schema ${schema} cascade`);
    await sql.end();
  });

  it('writes ledgers and the cursor once across a restart', async () => {
    const chain = {
      oldest: 1000,
      latest: 1002,
      txs: [...ledgerTxs(1000, 120, 3), ...ledgerTxs(1002, 260, 5), ...ledgerTxs(1004, 40, 1)],
    };
    const rpc = fakeRpc(chain);
    await catchUp({ rpc, store: sqlStore(sql), log: silent });
    expect(await readCursor(sql, TX_CURSOR)).toBe(1002);

    chain.latest = 1005;
    await catchUp({ rpc, store: sqlStore(sql), log: silent });
    await catchUp({ rpc, store: sqlStore(sql), log: silent });

    const summary = await readSummary(sql);
    expect(summary).toMatchObject({
      total: 420,
      failed: 9,
      outOfScope: 9,
      startLedger: 1000,
      endLedger: 1004,
    });
    expect(await readCursor(sql, TX_CURSOR)).toBe(1004);
    const [failures] = await sql<{ n: string }[]>`select count(*) as n from recent_failures`;
    expect(Number(failures?.n)).toBe(9);
  });
});
