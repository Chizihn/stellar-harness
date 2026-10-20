import { type Bucket, classify } from './classify';
import { envelopeSource, failureCode } from './decode';
import type { Rpc, RpcTx } from './rpc';

export type FailedTx = {
  ledger: number;
  closeTime: string;
  txHash: string;
  source: string;
  code: string;
  bucket: Bucket;
};

export type LedgerTally = {
  ledger: number;
  closeTime: string;
  total: number;
  failed: number;
  codes: { code: string; bucket: Bucket; count: number }[];
  accounts: { account: string; bucket: Bucket; count: number; dominantCode: string }[];
  failures: FailedTx[];
};

const UNKNOWN = 'unknown';

const safely = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

const toFailure = (tx: RpcTx, closeTime: string): FailedTx => {
  const code = safely(() => failureCode(tx.resultXdr) ?? 'tx_failed', UNKNOWN);
  return {
    ledger: tx.ledger,
    closeTime,
    txHash: tx.txHash,
    source: safely(() => envelopeSource(tx.envelopeXdr).source, UNKNOWN),
    code,
    bucket: classify(code).bucket,
  };
};

const dominant = (counts: Map<string, number>): string =>
  [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? UNKNOWN;

const tallyOne = (ledger: number, txs: RpcTx[]): LedgerTally => {
  const closeTime = new Date((txs[0]?.createdAt ?? 0) * 1000).toISOString();
  const failures = txs.filter((tx) => tx.status === 'FAILED').map((tx) => toFailure(tx, closeTime));
  const codes = new Map<string, { code: string; bucket: Bucket; count: number }>();
  const accounts = new Map<
    string,
    { account: string; bucket: Bucket; codes: Map<string, number> }
  >();
  for (const failure of failures) {
    const code = codes.get(failure.code) ?? {
      code: failure.code,
      bucket: failure.bucket,
      count: 0,
    };
    code.count += 1;
    codes.set(failure.code, code);
    const key = `${failure.source}|${failure.bucket}`;
    const account = accounts.get(key) ?? {
      account: failure.source,
      bucket: failure.bucket,
      codes: new Map<string, number>(),
    };
    account.codes.set(failure.code, (account.codes.get(failure.code) ?? 0) + 1);
    accounts.set(key, account);
  }
  return {
    ledger,
    closeTime,
    total: txs.length,
    failed: failures.length,
    codes: [...codes.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    accounts: [...accounts.values()].map((account) => ({
      account: account.account,
      bucket: account.bucket,
      count: [...account.codes.values()].reduce((sum, count) => sum + count, 0),
      dominantCode: dominant(account.codes),
    })),
    failures,
  };
};

export const tallyLedgers = (txs: RpcTx[]): LedgerTally[] => {
  const byLedger = new Map<number, RpcTx[]>();
  for (const tx of txs) {
    const group = byLedger.get(tx.ledger) ?? [];
    group.push(tx);
    byLedger.set(tx.ledger, group);
  }
  return [...byLedger.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ledger, group]) => tallyOne(ledger, group));
};

const PAGE_SIZE = 200;

export async function* readLedgerRange(
  rpc: Rpc,
  fromLedger: number,
  toLedger: number,
): AsyncIterable<LedgerTally[]> {
  let cursor: string | undefined;
  let pending: RpcTx[] = [];
  for (;;) {
    const page = await rpc.transactions(
      cursor ? { cursor, limit: PAGE_SIZE } : { startLedger: fromLedger, limit: PAGE_SIZE },
    );
    const inRange = page.transactions.filter((tx) => tx.ledger >= fromLedger);
    const passedEnd = inRange.some((tx) => tx.ledger > toLedger);
    pending.push(...inRange.filter((tx) => tx.ledger <= toLedger));
    const caughtUp = page.transactions.length < PAGE_SIZE;
    if (passedEnd || caughtUp) {
      if (pending.length > 0) yield tallyLedgers(pending);
      return;
    }
    const open = pending[pending.length - 1]?.ledger;
    const complete = pending.filter((tx) => tx.ledger !== open);
    pending = pending.filter((tx) => tx.ledger === open);
    if (complete.length > 0) yield tallyLedgers(complete);
    cursor = page.cursor;
  }
}
