import type { Operation, Policy } from '@harness/schema';
import { formatDecimal } from './format';

const OPERATION_LABELS: Record<Operation, string> = {
  extend_ttl: 'renew contracts',
  restore: 'restore contracts',
  sponsor_trustline: 'let accounts receive new assets',
  payment: 'make payments',
};

const listOf = (items: string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '');

const xlm = (value: number): string => `${formatDecimal(value, 2)} XLM`;

export const spendingRules = (policy: Policy): string[] => [
  `Spends up to ${xlm(policy.dailySpendXlm)} a day.`,
  `Needs the owner's approval above ${xlm(policy.approvalAboveXlm)}.`,
  policy.allowedOperations.length === 0
    ? 'May not run any fix on its own.'
    : `May ${listOf(policy.allowedOperations.map((operation) => OPERATION_LABELS[operation]))}.`,
];
