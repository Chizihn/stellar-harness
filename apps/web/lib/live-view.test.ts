import { describe, expect, it } from 'vitest';
import {
  formatAge,
  formatShare,
  formatUtc,
  formatXlm,
  isDelayed,
  secondsSince,
  yesterdayUtc,
} from './live-view';

const now = Date.parse('2026-10-21T00:02:00.000Z');

describe('live view helpers', () => {
  it('counts seconds since a close time and never goes negative', () => {
    expect(secondsSince('2026-10-21T00:01:57.000Z', now)).toBe(3);
    expect(secondsSince('2026-10-21T00:03:00.000Z', now)).toBe(0);
  });

  it('calls the feed delayed after two minutes or before any ledger', () => {
    expect(isDelayed('2026-10-21T00:00:00.000Z', now)).toBe(false);
    expect(isDelayed('2026-10-20T23:59:59.000Z', now)).toBe(true);
    expect(isDelayed(null, now)).toBe(true);
  });

  it('formats ages, shares, amounts and dates', () => {
    expect([formatAge(4), formatAge(125), formatAge(7200), formatAge(200_000)]).toEqual([
      '4s',
      '2m',
      '2h',
      '2d',
    ]);
    expect([formatShare(0.5), formatShare(0.0004), formatShare(0)]).toEqual(['50%', '<0.1%', '0%']);
    expect([formatXlm(1234.5), formatXlm(12.345), formatXlm(0.01234)]).toEqual([
      '1,235',
      '12.35',
      '0.0123',
    ]);
    expect(formatUtc('2026-10-21T14:05:09.000Z')).toBe('2026-10-21 14:05 UTC');
    expect(yesterdayUtc(now)).toBe('2026-10-20');
  });
});
