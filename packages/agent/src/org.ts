import { Action, type Org, type Policy } from '@harness/schema';
import type { Storage } from '@harness/storage';

export const ProposeActionInput = Action.omit({ id: true, withinPolicy: true, status: true });
export type ProposeActionInput = typeof ProposeActionInput._output;

export const isWithinPolicy = (policy: Policy, input: ProposeActionInput): boolean =>
  input.operation !== 'unsupported' &&
  policy.allowedOperations.includes(input.operation) &&
  input.estimatedCostXlm !== undefined &&
  input.estimatedCostXlm <= policy.approvalAboveXlm;

const orgSubjects = (org: Org): string[] => [
  ...org.accounts.map((account) => account.address),
  ...org.contracts.map((contract) => contract.id),
];

export const resolveSubject = (org: Org, ref: string): string => {
  const wanted = ref.trim().toLowerCase();
  const names: [string, string][] = [
    ...org.accounts.flatMap((a): [string, string][] => [
      [a.label, a.address],
      [a.role, a.address],
    ]),
    ...org.contracts.map((c): [string, string] => [c.label, c.id]),
  ];
  const subject = names.find(([name]) => name.toLowerCase() === wanted)?.[1] ?? ref.trim();
  if (!orgSubjects(org).includes(subject)) throw new Error(`${ref} does not belong to ${org.name}`);
  return subject;
};

export const proposeAction = async (
  storage: Storage,
  input: ProposeActionInput,
): Promise<Action> => {
  const org = await storage.getOrg();
  const action: Action = {
    ...input,
    subject: resolveSubject(org, input.subject),
    id: crypto.randomUUID(),
    withinPolicy: isWithinPolicy(org.policy, input),
    status: 'proposed',
  };
  await storage.putAction(action);
  return action;
};
