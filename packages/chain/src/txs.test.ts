import { FeeBumpTransaction, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import recorded from './__fixtures__/rpc-failed-txs.json';
import type { Rpc, RpcTx } from './rpc';
import { readLedgerRange, tallyLedgers } from './txs';

const [plain, feeBumped, noTrust] = recorded as [RpcTx, RpcTx, RpcTx];

const innerSource = (tx: RpcTx): string => {
  const parsed = TransactionBuilder.fromXdr(tx.envelopeXdr, Networks.PUBLIC);
  return parsed instanceof FeeBumpTransaction ? parsed.innerTransaction.source : parsed.source;
};

const success = (ledger: number, n: number): RpcTx => ({
  ...plain,
  txHash: `ok-${ledger}-${n}`,
  ledger,
  status: 'SUCCESS',
});

describe('tallyLedgers', () => {
  it('counts one failure per transaction by its inner source', () => {
    const ledger = plain.ledger;
    const fb = { ...feeBumped, ledger };
    const tallies = tallyLedgers([plain, success(ledger, 1), fb, noTrust]);
    expect(tallies).toHaveLength(1);
    const [tally] = tallies;
    expect(tally?.total).toBe(4);
    expect(tally?.failed).toBe(3);
    expect(tally?.closeTime).toBe(new Date(plain.createdAt * 1000).toISOString());
    expect(tally?.codes).toEqual([
      { code: 'op_underfunded', bucket: 'preventable', count: 2 },
      { code: 'op_no_trust', bucket: 'preventable', count: 1 },
    ]);
    expect(tally?.failures.map((f) => [f.txHash, f.source, f.code])).toEqual([
      [plain.txHash, innerSource(plain), 'op_underfunded'],
      [fb.txHash, innerSource(feeBumped), 'op_underfunded'],
      [noTrust.txHash, innerSource(noTrust), 'op_no_trust'],
    ]);
    const counted = tally?.accounts.reduce((sum, account) => sum + account.count, 0);
    expect(counted).toBe(tally?.failed);
  });

  it('groups accounts by bucket with their dominant code', () => {
    const ledger = 10;
    const txs = [
      { ...plain, ledger, txHash: 'a' },
      { ...plain, ledger, txHash: 'b' },
      { ...noTrust, ledger, txHash: 'c', envelopeXdr: plain.envelopeXdr },
      { ...plain, ledger, txHash: 'd', resultXdr: 'not-xdr' },
    ];
    const [tally] = tallyLedgers(txs);
    expect(tally?.accounts).toEqual([
      {
        account: innerSource(plain),
        bucket: 'preventable',
        count: 3,
        dominantCode: 'op_underfunded',
      },
      { account: innerSource(plain), bucket: 'out_of_scope', count: 1, dominantCode: 'unknown' },
    ]);
  });

  it('orders ledgers and leaves empty ledgers out', () => {
    const tallies = tallyLedgers([success(7, 0), success(5, 0), success(7, 1)]);
    expect(tallies.map((t) => [t.ledger, t.total, t.failed])).toEqual([
      [5, 1, 0],
      [7, 2, 0],
    ]);
  });
});

const pagedRpc = (txs: RpcTx[], pageSize: number) => {
  const requests: unknown[] = [];
  const rpc = {
    transactions: async (args: { startLedger?: number; cursor?: string; limit?: number }) => {
      requests.push(args);
      const from = args.cursor
        ? Number(args.cursor)
        : txs.findIndex((tx) => tx.ledger >= (args.startLedger ?? 0));
      const page = txs.slice(from, from + pageSize);
      return {
        transactions: page,
        latestLedger: 99,
        oldestLedger: 1,
        cursor: String(from + page.length),
      };
    },
  } as unknown as Rpc;
  return { rpc, requests };
};

describe('readLedgerRange', () => {
  const chain = [1, 2, 2, 2, 3, 4, 4, 5].map((ledger, n) => success(ledger, n));

  it('yields only complete ledgers and stops past the end', async () => {
    const txs = Array.from({ length: 450 }, (_, n) => success(100 + Math.floor(n / 150), n));
    const { rpc, requests } = pagedRpc(txs, 200);
    const batches: number[][] = [];
    for await (const batch of readLedgerRange(rpc, 100, 101)) {
      batches.push(batch.map((t) => t.total));
    }
    expect(batches).toEqual([[150], [150]]);
    expect(requests).toEqual([
      { startLedger: 100, limit: 200 },
      { cursor: '200', limit: 200 },
    ]);
  });

  it('flushes the last ledgers once caught up', async () => {
    const { rpc } = pagedRpc(chain, 200);
    const ledgers: number[] = [];
    for await (const batch of readLedgerRange(rpc, 2, 50))
      ledgers.push(...batch.map((t) => t.ledger));
    expect(ledgers).toEqual([2, 3, 4, 5]);
  });
});
