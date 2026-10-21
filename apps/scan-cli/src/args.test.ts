import { describe, expect, it } from 'vitest';
import { parseScanArgs } from './args';

describe('parseScanArgs', () => {
  it('reads a ledger range for txs', () => {
    expect(parseScanArgs(['txs', '--from', '100', '--to', '200'])).toEqual({
      command: 'txs',
      from: 100,
      to: 200,
    });
    expect(parseScanArgs(['--', 'txs', '--from=5', '--to=5'])).toEqual({
      command: 'txs',
      from: 5,
      to: 5,
    });
  });

  it('takes no options for contracts and all', () => {
    expect(parseScanArgs(['contracts'])).toEqual({ command: 'contracts' });
    expect(parseScanArgs(['all'])).toEqual({ command: 'all' });
    expect(() => parseScanArgs(['all', '--from', '1'])).toThrow('usage');
  });

  it.each([
    [[]],
    [['report']],
    [['txs']],
    [['txs', '--from', '10']],
    [['txs', '--from', 'ten', '--to', '20']],
    [['txs', '--from', '0', '--to', '20']],
    [['txs', '--from', '30', '--to', '20']],
    [['contracts', 'extra']],
    [['txs', '--from', '1', '--to', '2', '--limit', '3']],
  ])('rejects %j', (argv) => {
    expect(() => parseScanArgs(argv)).toThrow();
  });
});
