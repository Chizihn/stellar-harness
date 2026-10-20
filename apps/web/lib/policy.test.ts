import { describe, expect, it } from 'vitest';
import { spendingRules } from './policy';

describe('spendingRules', () => {
  it('reads the cap, the approval threshold and the allowed fixes from the policy', () => {
    expect(
      spendingRules({
        dailySpendXlm: 50,
        approvalAboveXlm: 10,
        allowedOperations: ['extend_ttl', 'restore', 'payment'],
      }),
    ).toEqual([
      'Spends up to 50 XLM a day.',
      "Needs the owner's approval above 10 XLM.",
      'May renew contracts, restore contracts and make payments.',
    ]);
  });

  it('says so when nothing is allowed', () => {
    expect(spendingRules({ dailySpendXlm: 0, approvalAboveXlm: 0, allowedOperations: [] })[2]).toBe(
      'May not run any fix on its own.',
    );
  });
});
