export type Bucket = 'preventable' | 'retryable' | 'out_of_scope';
export type CodeInfo = { code: string; bucket: Bucket; fix: string | null; plain: string };

export const BUCKETS: readonly Bucket[] = ['preventable', 'retryable', 'out_of_scope'];

const CLAIMABLE = 'Send as a claimable balance the receiver can collect later.';
const REQUOTE = 'Get a fresh price quote and retry within a set limit.';
const PRICE_MOVED = 'The price moved before the trade went through.';

const TABLE: Record<string, Omit<CodeInfo, 'code'>> = {
  op_underfunded: {
    bucket: 'preventable',
    fix: 'Top up the sending account from treasury before paying.',
    plain: "The sending account didn't have enough funds.",
  },
  op_no_trust: {
    bucket: 'preventable',
    fix: CLAIMABLE,
    plain: "The receiver hasn't enabled this asset yet.",
  },
  op_no_destination: {
    bucket: 'preventable',
    fix: CLAIMABLE,
    plain: "The receiving account doesn't exist yet.",
  },
  op_low_reserve: {
    bucket: 'preventable',
    fix: "Top up or sponsor the account's XLM reserve first.",
    plain: "The account didn't hold the minimum XLM Stellar requires.",
  },
  invoke_host_function_entry_archived: {
    bucket: 'preventable',
    fix: 'Restore the archived contract data before calling.',
    plain: "The contract's data had expired and was archived.",
  },
  tx_bad_seq: {
    bucket: 'preventable',
    fix: 'Send through separate channel accounts.',
    plain: 'Two transactions from one account collided.',
  },
  op_over_source_max: { bucket: 'retryable', fix: REQUOTE, plain: PRICE_MOVED },
  op_under_dest_min: { bucket: 'retryable', fix: REQUOTE, plain: PRICE_MOVED },
  invoke_host_function_resource_limit_exceeded: {
    bucket: 'retryable',
    fix: 'Re-simulate with more headroom and retry.',
    plain: 'The contract call needed more resources than budgeted.',
  },
  invoke_host_function_insufficient_refundable_fee: {
    bucket: 'retryable',
    fix: 'Re-simulate and retry with the correct fee.',
    plain: 'The fee set aside for the call was too low.',
  },
  tx_insufficient_fee: {
    bucket: 'retryable',
    fix: 'Raise the fee within a set cap and resubmit.',
    plain: 'The network was busy and the fee was too low.',
  },
  tx_too_late: {
    bucket: 'retryable',
    fix: 'Rebuild with a new time window and resubmit.',
    plain: 'The transaction expired before it was included.',
  },
};

export const classify = (code: string): CodeInfo => {
  const known = TABLE[code];
  return known
    ? { code, ...known }
    : { code, bucket: 'out_of_scope', fix: null, plain: 'Shown as "other".' };
};
