import type { Decorator } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WhatFailedRow } from '@/lib/live';
import type { ContractRow, RecentPayload, SummaryPayload, TopAccount } from '@/lib/live-schemas';
import { fakeAccount, fakeContract, fakeHash } from '../story-ids';

const ago = (seconds: number): string => new Date(Date.now() - seconds * 1000).toISOString();

const generatedAt = ago(0);

export const summaryFixture: SummaryPayload = {
  generatedAt,
  startLedger: 64_785_000,
  endLedger: 64_800_123,
  total: 1_204_311,
  failed: 48_220,
  preventable: 9_812,
  retryable: 21_407,
  outOfScope: 17_001,
  endCloseTime: ago(3),
  lagSeconds: 3,
  contracts: {
    checkedAt: ago(1800),
    archived: 41,
    expiring30d: 17,
    fixCostXlm: 312.4,
    fixCostUsd: 98.1,
    simulated: 58,
    simulationFailed: 2,
    xlmUsd: 0.314,
    priceSource: 'coingecko',
    priceTime: ago(1800),
    extendDays: 180,
  },
};

export const delayedSummary: SummaryPayload = {
  ...summaryFixture,
  endCloseTime: ago(600),
  lagSeconds: 600,
};

export const waitingSummary: SummaryPayload = {
  ...summaryFixture,
  total: 0,
  failed: 0,
  preventable: 0,
  retryable: 0,
  outOfScope: 0,
  startLedger: null,
  endLedger: null,
  endCloseTime: null,
  lagSeconds: null,
  contracts: null,
};

export const whatFailedFixture: WhatFailedRow[] = [
  {
    code: 'op_under_dest_min',
    bucket: 'retryable',
    count: 14_203,
    share: 0.2945,
    fix: 'Get a fresh price quote and retry within a set limit.',
    plain: 'The price moved before the trade went through.',
    grouped: [],
  },
  {
    code: 'op_underfunded',
    bucket: 'preventable',
    count: 7_101,
    share: 0.1473,
    fix: 'Top up the sending account from treasury before paying.',
    plain: "The sending account didn't have enough funds.",
    grouped: [],
  },
  {
    code: 'op_no_trust',
    bucket: 'preventable',
    count: 2_711,
    share: 0.0562,
    fix: 'Send as a claimable balance the receiver can collect later.',
    plain: "The receiver hasn't enabled this asset yet.",
    grouped: [],
  },
  {
    code: 'other',
    bucket: 'out_of_scope',
    count: 17_001,
    share: 0.3526,
    fix: null,
    plain: 'Failures the harness does not act on, grouped into one row.',
    grouped: ['invoke_host_function_trapped', 'op_cross_self'],
  },
];

const FEED_CODES = [
  ['op_under_dest_min', 'retryable', 'The price moved before the trade went through.'],
  ['op_underfunded', 'preventable', "The sending account didn't have enough funds."],
  ['invoke_host_function_trapped', 'out_of_scope', 'A failure the harness does not act on.'],
] as const;

export const recentFailure = (index: number, secondsAgo: number) => {
  const [code, bucket, plain] = FEED_CODES[index % FEED_CODES.length] ?? FEED_CODES[0];
  return {
    ledger: 64_800_123 - index,
    time: ago(secondsAgo),
    txHash: fakeHash(1000 + index),
    source: fakeAccount(`feed${index}`),
    code,
    bucket,
    plain,
  };
};

export const recentFixture: RecentPayload = {
  generatedAt,
  startLedger: summaryFixture.startLedger,
  endLedger: summaryFixture.endLedger,
  failures: Array.from({ length: 8 }, (_, index) => recentFailure(index, 3 + index * 4)),
};

export const archivedFixture: ContractRow[] = Array.from({ length: 12 }, (_, index) => ({
  contract: fakeContract(`arch${index}`),
  invocations: 9_000 - index * 611,
  liveUntilLedger: null,
  daysLeft: null,
  fixCostXlm: index === 3 ? null : 4.2 + index * 0.37,
}));

export const expiringFixture: ContractRow[] = Array.from({ length: 4 }, (_, index) => ({
  contract: fakeContract(`exp${index}`),
  invocations: 2_400 - index * 300,
  liveUntilLedger: 64_900_000 + index * 40_000,
  daysLeft: 5.8 + index * 6.1,
  fixCostXlm: 0.0412 + index * 0.01,
}));

export const topAccountsFixture: TopAccount[] = Array.from({ length: 25 }, (_, index) => ({
  account: fakeAccount(`top${index}`),
  preventable: index % 2 === 0 ? 400 - index * 9 : 0,
  retryable: index % 2 === 1 ? 380 - index * 8 : 12,
  dominantCode: index % 2 === 0 ? 'op_underfunded' : 'op_under_dest_min',
  plain:
    index % 2 === 0
      ? "The sending account didn't have enough funds."
      : 'The price moved before the trade went through.',
}));

export const withLiveQuery: Decorator = (Story) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { enabled: false } } })}
  >
    <Story />
  </QueryClientProvider>
);
