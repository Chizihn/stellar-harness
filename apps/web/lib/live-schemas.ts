import { z } from 'zod';

export const FEED_SIZE = 20;

export const LAG_DELAYED_SECONDS = 120;

const Bucket = z.enum(['preventable', 'retryable', 'out_of_scope']);

const Ledger = z.number().int().nullable();

const WindowShape = {
  generatedAt: z.string(),
  startLedger: Ledger,
  endLedger: Ledger,
};

export const ContractsSummary = z.object({
  checkedAt: z.string(),
  archived: z.number(),
  expiring30d: z.number(),
  fixCostXlm: z.number(),
  fixCostUsd: z.number().nullable(),
  simulated: z.number(),
  simulationFailed: z.number(),
  xlmUsd: z.number().nullable(),
  priceSource: z.string().nullable(),
  priceTime: z.string().nullable(),
  extendDays: z.number(),
});

export const SummaryPayload = z.object({
  ...WindowShape,
  total: z.number(),
  failed: z.number(),
  preventable: z.number(),
  retryable: z.number(),
  outOfScope: z.number(),
  endCloseTime: z.string().nullable(),
  lagSeconds: z.number().nullable(),
  contracts: ContractsSummary.nullable(),
});
export type SummaryPayload = z.infer<typeof SummaryPayload>;

export const CodeRow = z.object({
  code: z.string(),
  bucket: Bucket,
  count: z.number(),
  share: z.number(),
  fix: z.string().nullable(),
  plain: z.string(),
});
export type CodeRow = z.infer<typeof CodeRow>;

export const CodesPayload = z.object({ ...WindowShape, codes: z.array(CodeRow) });
export type CodesPayload = z.infer<typeof CodesPayload>;

export const RecentFailure = z.object({
  ledger: z.number().int(),
  time: z.string(),
  txHash: z.string(),
  source: z.string(),
  code: z.string(),
  bucket: Bucket,
});
export type RecentFailure = z.infer<typeof RecentFailure>;

export const RecentPayload = z.object({ ...WindowShape, failures: z.array(RecentFailure) });
export type RecentPayload = z.infer<typeof RecentPayload>;

export const TopAccount = z.object({
  account: z.string(),
  preventable: z.number(),
  retryable: z.number(),
  dominantCode: z.string(),
});
export type TopAccount = z.infer<typeof TopAccount>;

export const TopAccountsPayload = z.object({ ...WindowShape, accounts: z.array(TopAccount) });
export type TopAccountsPayload = z.infer<typeof TopAccountsPayload>;

export const ContractStatus = z.enum(['archived', 'expiring']);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const ContractRow = z.object({
  contract: z.string(),
  invocations: z.number(),
  liveUntilLedger: Ledger,
  daysLeft: z.number().nullable(),
  fixCostXlm: z.number().nullable(),
});
export type ContractRow = z.infer<typeof ContractRow>;

export const ContractsPayload = z.object({
  ...WindowShape,
  status: ContractStatus,
  checkedAt: z.string().nullable(),
  contracts: z.array(ContractRow),
});
export type ContractsPayload = z.infer<typeof ContractsPayload>;

export const SnapshotPayload = z.object({
  ...WindowShape,
  date: z.string(),
  snapshot: z.unknown(),
});
export type SnapshotPayload = z.infer<typeof SnapshotPayload>;

const limit = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

export const RecentQuery = z.object({ limit: limit(50, 100) });

export const TopAccountsQuery = z.object({ limit: limit(25, 100) });

export const ContractsQuery = z.object({ status: ContractStatus });

export const SnapshotParams = z.object({
  date: z.iso.date({ error: 'date must be YYYY-MM-DD' }),
});
