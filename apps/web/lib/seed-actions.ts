import { proposeAction } from '@harness/agent';
import type { Org, OrgContract } from '@harness/schema';
import {
  type ContractTtl,
  MAX_EXTEND_DAYS,
  type Preflight,
  type Simulation,
} from '@harness/stellar-tools';
import type { Storage } from '@harness/storage';
import { formatDecimal } from './format';

export const SEED_EVERY_MS = 10 * 60_000;
const ATTENTION_DAYS = 30;
const TRUSTLINE_RESERVE_XLM = 0.5;

export type SeedReads = {
  getContractTtl: (contractId: string) => Promise<ContractTtl>;
  simulateExtendTtl: (contractId: string, days: number) => Promise<Simulation>;
  simulateRestore: (contractId: string) => Promise<Simulation>;
  buildPaymentPreflight: (from: string, to: string, asset: string) => Promise<Preflight>;
};

const quietly = async (step: () => Promise<unknown>) => {
  try {
    await step();
  } catch {}
};

const seedContract = async (storage: Storage, reads: SeedReads, contract: OrgContract) => {
  const ttl = await reads.getContractTtl(contract.id);
  if (ttl.instance.archived) {
    const simulation = await reads.simulateRestore(contract.id);
    await proposeAction(storage, {
      subject: contract.id,
      title: `Restore ${contract.label}`,
      why: `${contract.label} is archived; restoring it makes it callable again.`,
      operation: 'restore',
      estimatedCostXlm: simulation.estimatedCostXlm,
    });
    return;
  }
  if (ttl.instance.daysLeft >= ATTENTION_DAYS) return;
  const simulation = await reads.simulateExtendTtl(contract.id, MAX_EXTEND_DAYS);
  await proposeAction(storage, {
    subject: contract.id,
    title: `Keep ${contract.label} alive for ${MAX_EXTEND_DAYS} days`,
    why: `${contract.label} expires in ${formatDecimal(ttl.instance.daysLeft, 1)} days; extending keeps it callable.`,
    operation: 'extend_ttl',
    estimatedCostXlm: simulation.estimatedCostXlm,
  });
};

const seedTrustline = async (storage: Storage, reads: SeedReads, org: Org) => {
  const treasury = org.accounts.find((account) => account.role === 'treasury');
  const distribution = org.accounts.find((account) => account.role === 'distribution');
  if (!treasury || !distribution) return;
  const preflight = await reads.buildPaymentPreflight(
    treasury.address,
    distribution.address,
    'USDC',
  );
  if (!preflight.blockers.some((blocker) => blocker.code === 'op_no_trust')) return;
  await proposeAction(storage, {
    subject: distribution.address,
    title: `Let ${distribution.label} receive USDC`,
    why: `${distribution.label} has no USDC trustline, so payments to it fail; the cost is the ${TRUSTLINE_RESERVE_XLM} XLM base reserve the sponsor locks.`,
    operation: 'sponsor_trustline',
    estimatedCostXlm: TRUSTLINE_RESERVE_XLM,
  });
};

export const seedActions = async (storage: Storage, reads: SeedReads): Promise<void> => {
  const org = await storage.getOrg();
  await Promise.all([
    ...org.contracts.map((contract) => quietly(() => seedContract(storage, reads, contract))),
    quietly(() => seedTrustline(storage, reads, org)),
  ]);
};
