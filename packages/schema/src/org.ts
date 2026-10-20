import { z } from 'zod';

export const NETWORKS = ['testnet', 'mainnet'] as const;
export const Network = z.enum(NETWORKS);
export type Network = z.infer<typeof Network>;

export const DEFAULT_NETWORK: Network = 'mainnet';

export const OPERATIONS = ['extend_ttl', 'restore', 'sponsor_trustline', 'payment'] as const;
export const Operation = z.enum(OPERATIONS);
export type Operation = z.infer<typeof Operation>;

export const Policy = z.object({
  dailySpendXlm: z.number().nonnegative(),
  allowedOperations: z.array(Operation),
  approvalAboveXlm: z.number().nonnegative(),
});
export type Policy = z.infer<typeof Policy>;

export const OrgAccount = z.object({
  address: z.string(),
  label: z.string(),
  role: z.enum(['treasury', 'distribution', 'issuer', 'other']),
});
export type OrgAccount = z.infer<typeof OrgAccount>;

export const OrgContract = z.object({ id: z.string(), label: z.string() });
export type OrgContract = z.infer<typeof OrgContract>;

export const Org = z.object({
  id: z.string(),
  name: z.string(),
  network: Network,
  accounts: z.array(OrgAccount),
  contracts: z.array(OrgContract),
  policy: Policy,
});
export type Org = z.infer<typeof Org>;

export const Action = z.object({
  id: z.string(),
  subject: z.string(),
  title: z.string(),
  why: z.string(),
  operation: z.union([Operation, z.literal('unsupported')]),
  estimatedCostXlm: z.number().nonnegative().optional(),
  withinPolicy: z.boolean(),
  status: z.literal('proposed'),
});
export type Action = z.infer<typeof Action>;
