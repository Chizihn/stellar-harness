import { xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import samples from './__fixtures__/mainnet-results.json';
import { classify } from './classify';
import { failureCode } from './decode';

const encode = (result: xdr.TransactionResultResult): string =>
  new xdr.TransactionResult({
    feeCharged: 100n,
    result,
    ext: xdr.TransactionResultExt.v0(),
  }).toXdr('base64');

describe('failureCode on real mainnet results', () => {
  it.each(samples.map((sample) => [sample.name, sample] as const))('%s', (_name, sample) => {
    expect(failureCode(sample.resultXdr)).toBe(sample.code);
  });

  it('covers an op code, a fee bump and the soroban variants', () => {
    const codes = new Set(samples.map((sample) => sample.code));
    for (const code of [
      'op_underfunded',
      'invoke_host_function_trapped',
      'invoke_host_function_resource_limit_exceeded',
      'invoke_host_function_entry_archived',
      'invoke_host_function_insufficient_refundable_fee',
    ]) {
      expect(codes).toContain(code);
    }
    expect(samples.some((sample) => sample.name.startsWith('fee bump'))).toBe(true);
  });

  it('gives buckets that sum to the failed total', () => {
    const buckets = samples.map((sample) => classify(failureCode(sample.resultXdr) ?? '').bucket);
    const counts = ['preventable', 'retryable', 'out_of_scope'].map(
      (bucket) => buckets.filter((b) => b === bucket).length,
    );
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(samples.length);
  });
});

describe('failureCode rules', () => {
  it('returns null for successful transactions', () => {
    expect(failureCode(encode(xdr.TransactionResultResult.txSuccess([])))).toBeNull();
  });

  it('uses a tx-level code as is', () => {
    expect(failureCode(encode(xdr.TransactionResultResult.txTooLate()))).toBe('tx_too_late');
    expect(failureCode(encode(xdr.TransactionResultResult.txBadSeq()))).toBe('tx_bad_seq');
    expect(failureCode(encode(xdr.TransactionResultResult.txInsufficientFee()))).toBe(
      'tx_insufficient_fee',
    );
  });

  it('decodes the inner result of a failed fee bump', () => {
    const feeBump = encode(
      xdr.TransactionResultResult.txFeeBumpInnerFailed(
        new xdr.InnerTransactionResultPair({
          transactionHash: new Uint8Array(32),
          result: new xdr.InnerTransactionResult({
            feeCharged: 100n,
            result: xdr.InnerTransactionResultResult.txTooLate(),
            ext: xdr.InnerTransactionResultExt.v0(),
          }),
        }),
      ),
    );
    expect(failureCode(feeBump)).toBe('tx_too_late');
  });

  it('names every invoke_host_function failure after the operation', () => {
    const op = (result: xdr.InvokeHostFunctionResult) =>
      encode(
        xdr.TransactionResultResult.txFailed([
          xdr.OperationResult.opInner(xdr.OperationResultTr.invokeHostFunction(result)),
        ]),
      );
    expect(failureCode(op(xdr.InvokeHostFunctionResult.invokeHostFunctionTrapped()))).toBe(
      'invoke_host_function_trapped',
    );
    expect(
      failureCode(op(xdr.InvokeHostFunctionResult.invokeHostFunctionInsufficientRefundableFee())),
    ).toBe('invoke_host_function_insufficient_refundable_fee');
    expect(
      failureCode(op(xdr.InvokeHostFunctionResult.invokeHostFunctionResourceLimitExceeded())),
    ).toBe('invoke_host_function_resource_limit_exceeded');
    expect(failureCode(op(xdr.InvokeHostFunctionResult.invokeHostFunctionEntryArchived()))).toBe(
      'invoke_host_function_entry_archived',
    );
  });
});
