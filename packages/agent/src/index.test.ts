import type { Org } from '@harness/schema';
import type { Clients } from '@harness/stellar-tools';
import { MemoryStorage } from '@harness/storage';
import { describe, expect, it } from 'vitest';
import { createAgentTools, type MainnetReport, orgBrief, SYSTEM_PROMPT } from './index';

const org: Org = {
  id: 'demo',
  name: 'Demo Treasury Ltd',
  network: 'testnet',
  accounts: [],
  contracts: [],
  policy: { dailySpendXlm: 50, allowedOperations: [], approvalAboveXlm: 10 },
};

const report: MainnetReport = {
  summary: {
    total: 100,
    failed: 10,
    preventable: 6,
    retryable: 3,
    outOfScope: 1,
    startLedger: 1,
    endLedger: 2,
    contracts: null,
  },
  topCodes: [{ code: 'op_underfunded', bucket: 'preventable', count: 6, share: 0.6, fix: null }],
};

describe('orgBrief', () => {
  it('names every account and contract label', () => {
    const brief = orgBrief({
      ...org,
      accounts: [{ address: 'G1', label: 'Treasury', role: 'treasury' }],
      contracts: [{ id: 'C1', label: 'Escrow' }],
    });
    expect(brief).toContain('Treasury (treasury)');
    expect(brief).toContain('Escrow');
  });
});

describe('getMainnetReport', () => {
  it('returns what the injected reader returns', async () => {
    const tools = createAgentTools(new MemoryStorage(org), {} as Clients, {
      readMainnetReport: async () => report,
    });
    expect(
      await tools.getMainnetReport.execute?.({}, { toolCallId: 't', messages: [], context: {} }),
    ).toEqual(report);
  });

  it('is what the prompt sends network questions to', () => {
    expect(SYSTEM_PROMPT).toContain('call getMainnetReport once');
  });
});
