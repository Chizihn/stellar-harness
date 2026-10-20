import { describe, expect, it } from 'vitest';
import { USER_AGENT } from './http';
import { createRpc } from './rpc';
import { fakeFetch, rpcResult } from './testing';

const URL = 'https://rpc.test';

const recordSleeps = () => {
  const waits: number[] = [];
  return { waits, options: { sleep: async (ms: number) => void waits.push(ms), baseDelayMs: 100 } };
};

describe('createRpc', () => {
  it('sends an honest user agent and reads the latest ledger', async () => {
    const fetch = fakeFetch(() => rpcResult({ sequence: 42 }));
    expect(await createRpc(URL, fetch.impl).latestLedger()).toBe(42);
    expect(fetch.calls[0]?.headers['user-agent']).toBe(USER_AGENT);
    expect(fetch.calls[0]?.body).toMatchObject({ method: 'getLatestLedger' });
  });

  it('retries 429 and honours Retry-After', async () => {
    const { waits, options } = recordSleeps();
    let n = 0;
    const fetch = fakeFetch(() =>
      n++ === 0 ? { status: 429, headers: { 'retry-after': '3' } } : rpcResult({ sequence: 7 }),
    );
    expect(await createRpc(URL, fetch.impl, options).latestLedger()).toBe(7);
    expect(fetch.calls).toHaveLength(2);
    expect(waits).toEqual([3000]);
  });

  it('backs off exponentially on 5xx and gives up after the attempt limit', async () => {
    const { waits, options } = recordSleeps();
    const fetch = fakeFetch(() => ({ status: 503 }));
    await expect(
      createRpc(URL, fetch.impl, { ...options, attempts: 4 }).latestLedger(),
    ).rejects.toThrow('HTTP 503');
    expect(fetch.calls).toHaveLength(4);
    expect(waits).toEqual([100, 200, 400]);
  });

  it('does not retry JSON-RPC errors', async () => {
    const fetch = fakeFetch(() => ({
      body: { jsonrpc: '2.0', id: 1, error: { code: -32600, message: 'start ledger too old' } },
    }));
    await expect(createRpc(URL, fetch.impl).transactions({ startLedger: 1 })).rejects.toThrow(
      'start ledger too old',
    );
    expect(fetch.calls).toHaveLength(1);
  });

  it('pages transactions by start ledger then by cursor', async () => {
    const page = { transactions: null, latestLedger: 10, oldestLedger: 1, cursor: 'c1' };
    const fetch = fakeFetch(() => rpcResult(page));
    const rpc = createRpc(URL, fetch.impl);
    expect(await rpc.transactions({ startLedger: 5 })).toEqual({ ...page, transactions: [] });
    await rpc.transactions({ cursor: 'c1', limit: 50 });
    expect(fetch.calls.map((call) => (call.body as { params: unknown }).params)).toEqual([
      { startLedger: 5, pagination: { limit: 200 }, xdrFormat: 'base64' },
      { pagination: { limit: 50, cursor: 'c1' }, xdrFormat: 'base64' },
    ]);
  });

  it('maps ledgers, ledger entries and simulations', async () => {
    const fetch = fakeFetch(({ body }) => {
      const method = (body as { method: string }).method;
      if (method === 'getLedgers')
        return rpcResult({ ledgers: [{ sequence: 9, ledgerCloseTime: '1700000000', hash: 'h' }] });
      if (method === 'getLedgerEntries')
        return rpcResult({ entries: [{ key: 'k', xdr: 'x', liveUntilLedgerSeq: 12 }] });
      return rpcResult({ minResourceFee: '1234', latestLedger: 9 });
    });
    const rpc = createRpc(URL, fetch.impl);
    expect(await rpc.ledgers({ startLedger: 9 })).toEqual([
      { sequence: 9, closeTime: 1_700_000_000 },
    ]);
    expect(await rpc.ledgerEntries(['k'])).toEqual([
      { key: 'k', xdr: 'x', liveUntilLedgerSeq: 12 },
    ]);
    expect(await rpc.simulate('tx')).toEqual({ minResourceFee: '1234' });
  });
});
