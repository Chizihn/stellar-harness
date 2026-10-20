# @harness/chain

Reads Stellar mainnet and turns it into the numbers on `/report`. Pure functions and HTTP clients, no
database. The worker, the CLI and the API all use this one implementation.

## Method

### Decoder (`decode.ts`)

Each transaction result counts as at most one failure.

- `txSUCCESS` and `txFEE_BUMP_INNER_SUCCESS` are not failures.
- `txFAILED`: the code of the first operation that did not succeed, for example `op_underfunded`.
- Any other transaction code is used as is, for example `tx_too_late`.
- `txFEE_BUMP_INNER_FAILED`: the inner result is decoded with the two rules above.
- Names follow Horizon (`horizon-codes.json`), in lower snake case. Soroban operation results keep
  their operation name: `invoke_host_function_trapped`, `invoke_host_function_resource_limit_exceeded`,
  `invoke_host_function_entry_archived`, `invoke_host_function_insufficient_refundable_fee`, and the
  same pattern for `extend_footprint_ttl_*` and `restore_footprint_*`.
- A result the SDK cannot parse is counted as `unknown`. Codes are only ever read from the ledger,
  never inferred.

The account of a failure is the transaction source. For a fee bump it is the inner transaction's
source, not the fee payer.

### Buckets (`classify.ts`)

Every code falls in exactly one bucket, so `preventable + retryable + out_of_scope = failed`.

- `preventable`: a check before sending would have stopped it (`op_underfunded`, `op_no_trust`,
  `op_no_destination`, `op_low_reserve`, `invoke_host_function_entry_archived`, `tx_bad_seq`).
- `retryable`: the same intent can be retried and completed (`op_over_source_max`,
  `op_under_dest_min`, `invoke_host_function_resource_limit_exceeded`,
  `invoke_host_function_insufficient_refundable_fee`, `tx_insufficient_fee`, `tx_too_late`).
- `out_of_scope`: everything else, shown as "other".

### Active contracts (`contracts.ts`)

A contract is active when it has 100 or more lifetime invocations on stellar.expert, or when
stellarlight lists it under an SCF-funded project. stellar.expert cannot sort by invocations, so the
whole list is paged once a day.

Each active contract's instance entry and wasm code entry are read with `getLedgerEntries`, 200 keys
per call. A contract is `archived` when either entry is missing or its `liveUntilLedgerSeq` is below
the latest ledger. It is `expiring` when the earlier of the two expires within 30 days. Days are
computed from the close time measured over the last 100 ledgers. Contracts whose lookup failed are
left out for that run.

### Fix cost

The fix never promises more than the ledger allows. The longest extension is read from the
network's `CONFIG_SETTING_STATE_ARCHIVAL` entry: `maxEntryTtl - 1` ledgers.

- Archived: `simulateTransaction` of `RestoreFootprint` plus `ExtendFootprintTTL` to that maximum.
- Expiring: `simulateTransaction` of `ExtendFootprintTTL` to that maximum.

The cost is the sum of `minResourceFee` in XLM. A failed simulation stores `null` and counts toward
`simulationFailed`. Nothing is guessed. The XLM/USD price is one CoinGecko call per run. Nothing is
ever submitted: the client has no `sendTransaction`.

### Endpoints

- Soroban RPC (`RPC_URL`, default `https://mainnet.sorobanrpc.com`): `getLatestLedger`,
  `getTransactions`, `getLedgers`, `getLedgerEntries`, `simulateTransaction`.
- `https://api.stellar.expert/explorer/public/contract?limit=200&order=desc`, following
  `_links.next`.
- `https://stellarlight.xyz/api/projects/search?scfAwarded=1` and `/api/repos/search`.
- `https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd`.

Every request sends `User-Agent: stellar-harness/0.2 (+https://github.com/devodii/stellar-harness)`
and retries 429 and 5xx with exponential backoff, waiting for `Retry-After` when the server sends
it.
