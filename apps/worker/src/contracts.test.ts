import type { ContractCheck } from '@harness/chain';
import { describe, expect, it, vi } from 'vitest';
import { runContracts } from './run';
import { fakeRpc, memoryStore, silent } from './testing';

const chain = vi.hoisted(() => ({
  rows: [] as ContractCheck[],
  listed: 0,
}));

vi.mock('@harness/chain', async (original) => ({
  ...(await original<typeof import('@harness/chain')>()),
  listActiveContracts: async () => {
    chain.listed += 1;
    return [{ contract: 'CFRESH', invocations: 900, scfProject: null }];
  },
  checkContracts: async () => ({
    rows: chain.rows,
    simulated: chain.rows.filter((row) => row.fixCostXlm !== null).length,
    simulationFailed: chain.rows.filter((row) => row.fixCostXlm === null).length,
    closeSeconds: 5.5,
    latestLedger: 1000,
  }),
  readMaxExtendLedgers: async () => 3_110_399,
  fetchXlmUsd: async () => ({ price: 0.2, source: 'test', time: '2026-10-21T00:00:00.000Z' }),
}));

const row = (contract: string, status: ContractCheck['status'], fixCostXlm: number | null) => ({
  contract,
  status,
  invocations: 100,
  liveUntilLedger: null,
  daysLeft: null,
  fixCostXlm,
  scfProject: null,
});

const deps = (store: ReturnType<typeof memoryStore>['store']) => ({
  rpc: fakeRpc({ oldest: 1, latest: 1000, txs: [] }),
  store,
  log: silent,
  simulationSource: 'G',
  now: () => new Date('2026-10-21T12:00:00.000Z'),
});

describe('runContracts totals', () => {
  it('sums known costs, prices them once and reads the extension from the ledger', async () => {
    chain.rows = [row('A', 'archived', 2), row('B', 'expiring', 0.5), row('C', 'archived', null)];
    const { store, state } = memoryStore();
    const meta = await runContracts(deps(store));
    expect(meta).toEqual({
      checkedAt: '2026-10-21T12:00:00.000Z',
      archived: 2,
      expiring30d: 1,
      fixCostXlm: 2.5,
      fixCostUsd: 0.5,
      simulated: 2,
      simulationFailed: 1,
      xlmUsd: 0.2,
      priceSource: 'test',
      priceTime: '2026-10-21T00:00:00.000Z',
      extendDays: Math.round((3_110_399 * 5.5) / 86_400),
    });
    expect(state.contracts).toEqual(meta);
    expect(state.active.rows.map((r) => r.contract)).toEqual(['CFRESH']);
  });

  it('reuses an active list younger than a day', async () => {
    chain.rows = [row('A', 'archived', 1)];
    chain.listed = 0;
    const { store, state } = memoryStore();
    state.active = {
      rows: [{ contract: 'CSTORED', invocations: 100, scfProject: null }],
      refreshedAt: '2026-10-21T01:00:00.000Z',
    };
    await runContracts(deps(store));
    expect(chain.listed).toBe(0);
  });

  it('does not replace good data with an empty result', async () => {
    chain.rows = [];
    const { store, state } = memoryStore();
    await expect(runContracts(deps(store))).rejects.toThrow('keeping the stored results');
    expect(state.replacedContracts).toBe(0);
  });
});
