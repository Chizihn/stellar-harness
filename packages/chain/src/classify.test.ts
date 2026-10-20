import { describe, expect, it } from 'vitest';
import { BUCKETS, type Bucket, classify } from './classify';

const TABLE = [
  [
    'op_underfunded',
    'preventable',
    'Top up the sending account from treasury before paying.',
    "The sending account didn't have enough funds.",
  ],
  [
    'op_no_trust',
    'preventable',
    'Send as a claimable balance the receiver can collect later.',
    "The receiver hasn't enabled this asset yet.",
  ],
  [
    'op_no_destination',
    'preventable',
    'Send as a claimable balance the receiver can collect later.',
    "The receiving account doesn't exist yet.",
  ],
  [
    'op_low_reserve',
    'preventable',
    "Top up or sponsor the account's XLM reserve first.",
    "The account didn't hold the minimum XLM Stellar requires.",
  ],
  [
    'invoke_host_function_entry_archived',
    'preventable',
    'Restore the archived contract data before calling.',
    "The contract's data had expired and was archived.",
  ],
  [
    'tx_bad_seq',
    'preventable',
    'Send through separate channel accounts.',
    'Two transactions from one account collided.',
  ],
  [
    'op_over_source_max',
    'retryable',
    'Get a fresh price quote and retry within a set limit.',
    'The price moved before the trade went through.',
  ],
  [
    'op_under_dest_min',
    'retryable',
    'Get a fresh price quote and retry within a set limit.',
    'The price moved before the trade went through.',
  ],
  [
    'invoke_host_function_resource_limit_exceeded',
    'retryable',
    'Re-simulate with more headroom and retry.',
    'The contract call needed more resources than budgeted.',
  ],
  [
    'invoke_host_function_insufficient_refundable_fee',
    'retryable',
    'Re-simulate and retry with the correct fee.',
    'The fee set aside for the call was too low.',
  ],
  [
    'tx_insufficient_fee',
    'retryable',
    'Raise the fee within a set cap and resubmit.',
    'The network was busy and the fee was too low.',
  ],
  [
    'tx_too_late',
    'retryable',
    'Rebuild with a new time window and resubmit.',
    'The transaction expired before it was included.',
  ],
] as const;

describe('classify', () => {
  it.each(TABLE)('%s is %s', (code, bucket, fix, plain) => {
    expect(classify(code)).toEqual({ code, bucket, fix, plain });
  });

  it.each(['invoke_host_function_trapped', 'op_line_full', 'tx_failed', 'made_up_code'])(
    '%s is out of scope',
    (code) => {
      expect(classify(code)).toEqual({
        code,
        bucket: 'out_of_scope',
        fix: null,
        plain: 'Shown as "other".',
      });
    },
  );

  it('puts every failure in exactly one bucket', () => {
    const failures = [
      ...TABLE.map(([code]) => code),
      'invoke_host_function_trapped',
      'op_line_full',
      'op_underfunded',
      'unknown',
    ];
    const counts = Object.fromEntries(BUCKETS.map((bucket) => [bucket, 0])) as Record<
      Bucket,
      number
    >;
    for (const code of failures) counts[classify(code).bucket] += 1;
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(failures.length);
    expect(counts).toEqual({ preventable: 7, retryable: 6, out_of_scope: 3 });
  });
});
