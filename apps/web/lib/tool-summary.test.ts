import { describe, expect, it } from 'vitest';
import { isToolRunning, summarizeToolParts } from './tool-summary';

const done = (tool: string) => ({ type: `tool-${tool}`, state: 'output-available' });

describe('summarizeToolParts', () => {
  it('counts what the harness did, joined with commas', () => {
    expect(
      summarizeToolParts([
        done('getOrg'),
        done('getContractTtl'),
        done('getContractTtl'),
        done('simulateExtendTtl'),
      ]),
    ).toBe('checked 2 contracts, simulated 1 fix');
  });

  it('groups restores with extensions and counts failures', () => {
    expect(
      summarizeToolParts([
        done('simulateRestore'),
        done('simulateExtendTtl'),
        { type: 'tool-proposeAction', state: 'output-error' },
      ]),
    ).toBe('simulated 2 fixes, proposed 1 fix, 1 failed');
  });

  it('names the report and falls back to the company read', () => {
    expect(summarizeToolParts([done('getMainnetReport')])).toBe('read the mainnet report');
    expect(summarizeToolParts([done('getOrg')])).toBe('read the demo company');
  });
});

describe('isToolRunning', () => {
  it('is true while any call has no output yet', () => {
    expect(isToolRunning([done('getOrg')])).toBe(false);
    expect(isToolRunning([{ type: 'tool-getOrg', state: 'input-available' }])).toBe(true);
  });
});
