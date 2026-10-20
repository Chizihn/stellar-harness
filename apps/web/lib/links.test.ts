import { describe, expect, it } from 'vitest';
import { explorerUrl, subjectHref, toContractId } from './links';

describe('explorer links', () => {
  it('point at the public explorer by default and the testnet one on testnet', () => {
    expect(explorerUrl('tx', 'abc')).toBe('https://stellar.expert/explorer/public/tx/abc');
    expect(explorerUrl('tx', 'abc', 'testnet')).toBe(
      'https://stellar.expert/explorer/testnet/tx/abc',
    );
    expect(
      subjectHref(
        'contract',
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        'testnet',
      ),
    ).toBe(
      'https://stellar.expert/explorer/testnet/contract/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    );
  });

  it('turns a raw hex contract id into its C... address and never links anything else', () => {
    const hex = '0013c216736f0c12bf9e1b3fd46176abbbed49781590859aedff59a09c52dcc1';
    const strkey = 'CAABHQQWONXQYEV7TYNT7VDBO2V3X3KJPAKZBBM25X7VTIE4KLOMCHES';
    expect(toContractId('0'.repeat(64))).toBe(
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    );
    expect(toContractId(hex)).toBe(strkey);
    expect(subjectHref('contract', hex)).toBe(
      `https://stellar.expert/explorer/public/contract/${strkey}`,
    );
    expect(explorerUrl('contract', hex)).toBe(
      `https://stellar.expert/explorer/public/contract/${strkey}`,
    );
    expect(subjectHref('contract', 'not-a-contract')).toBeUndefined();
  });
});
