import type { Org } from '@harness/schema';
import type { ContractTtl, Simulation } from '@harness/stellar-tools';
import { MemoryStorage } from '@harness/storage';
import { describe, expect, it } from 'vitest';
import { type SeedReads, seedActions } from './seed-actions';

const org: Org = {
  id: 'demo',
  name: 'Demo Treasury Ltd',
  network: 'testnet',
  accounts: [
    { address: 'GTREASURY', label: 'Treasury', role: 'treasury' },
    { address: 'GDIST', label: 'Distribution', role: 'distribution' },
  ],
  contracts: [
    { id: 'CESCROW', label: 'Escrow' },
    { id: 'CREGISTRY', label: 'Registry' },
  ],
  policy: {
    dailySpendXlm: 50,
    allowedOperations: ['extend_ttl', 'restore', 'sponsor_trustline'],
    approvalAboveXlm: 10,
  },
};

const ttl = (daysLeft: number, archived = false): ContractTtl => ({
  contractId: 'C',
  latestLedger: 1,
  wasmHash: null,
  instance: { liveUntilLedger: null, daysLeft, archived },
  code: null,
});

const simulation = (estimatedCostXlm: number): Simulation => ({
  contractId: 'C',
  operation: 'op',
  minResourceFeeStroops: 1,
  estimatedCostXlm,
  footprintEntries: 2,
  latestLedger: 1,
});

const reads = (overrides: Partial<SeedReads> = {}): SeedReads => ({
  getContractTtl: async (id) => (id === 'CESCROW' ? ttl(6.9) : ttl(365)),
  simulateExtendTtl: async () => simulation(27.31),
  simulateRestore: async () => simulation(0.01),
  buildPaymentPreflight: async () => ({
    ok: false,
    blockers: [{ code: 'op_no_trust', plain: 'no trustline', fix: 'add one' }],
  }),
  ...overrides,
});

describe('seedActions', () => {
  it('proposes extending an expiring contract and sponsoring the missing trustline', async () => {
    const storage = new MemoryStorage(org);
    await seedActions(storage, reads());
    const actions = await storage.listActions();
    expect(actions.map((a) => [a.title, a.operation, a.withinPolicy]).sort()).toEqual([
      ['Keep Escrow alive for 180 days', 'extend_ttl', false],
      ['Let Distribution receive USDC', 'sponsor_trustline', true],
    ]);
    expect(actions.find((a) => a.operation === 'extend_ttl')?.why).toBe(
      'Escrow expires in 6.9 days; extending keeps it callable.',
    );
  });

  it('proposes a restore for an archived contract', async () => {
    const storage = new MemoryStorage(org);
    await seedActions(storage, reads({ getContractTtl: async () => ttl(0, true) }));
    const restores = (await storage.listActions()).filter((a) => a.operation === 'restore');
    expect(restores.map((a) => a.title).sort()).toEqual(['Restore Escrow', 'Restore Registry']);
  });

  it('keeps seeding when one read fails and never duplicates on a second run', async () => {
    const storage = new MemoryStorage(org);
    const failing = reads({
      getContractTtl: async (id) => {
        if (id === 'CREGISTRY') throw new Error('rpc down');
        return ttl(6.9);
      },
    });
    await seedActions(storage, failing);
    await seedActions(storage, failing);
    expect(await storage.listActions()).toHaveLength(2);
  });
});
