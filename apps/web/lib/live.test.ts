import type { LiveSummary } from '@harness/storage/live';
import { describe, expect, it } from 'vitest';
import {
  buildCodes,
  buildContracts,
  buildMainnetReport,
  buildRecent,
  buildSnapshot,
  buildSummary,
  whatFailedRows,
} from './live';

const now = new Date('2026-10-21T12:00:30.000Z');
const window = { generatedAt: now.toISOString(), startLedger: 100, endLedger: 200 };

const summary: LiveSummary = {
  total: 1000,
  failed: 40,
  preventable: 25,
  retryable: 10,
  outOfScope: 5,
  startLedger: 100,
  endLedger: 200,
  endCloseTime: '2026-10-21T12:00:00.000Z',
  contracts: null,
};

const rows = [
  { code: 'op_no_trust', bucket: 'preventable' as const, count: 5 },
  { code: 'op_underfunded', bucket: 'preventable' as const, count: 20 },
  { code: 'op_over_source_max', bucket: 'retryable' as const, count: 10 },
  { code: 'contract_trapped_x', bucket: 'out_of_scope' as const, count: 3 },
  { code: 'op_line_full', bucket: 'out_of_scope' as const, count: 2 },
];

describe('buildSummary', () => {
  it('measures lag from the newest ledger close time', () => {
    const payload = buildSummary(summary, now);
    expect(payload.lagSeconds).toBe(30);
    expect(payload).toMatchObject({ generatedAt: now.toISOString(), startLedger: 100 });
  });

  it('has no lag before the first ledger', () => {
    const empty = { ...summary, endCloseTime: null, startLedger: null, endLedger: null };
    expect(buildSummary(empty, now).lagSeconds).toBeNull();
  });
});

describe('buildCodes', () => {
  it('sorts by count, adds shares and the fix from the classifier', () => {
    const { codes } = buildCodes(rows, window);
    expect(codes.map((row) => row.code)).toEqual([
      'op_underfunded',
      'op_over_source_max',
      'op_no_trust',
      'contract_trapped_x',
      'op_line_full',
    ]);
    expect(codes[0]).toMatchObject({
      share: 0.5,
      fix: 'Top up the sending account from treasury before paying.',
    });
    expect(codes.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1);
    expect(codes.at(-1)?.fix).toBeNull();
  });

  it('gives zero shares when nothing failed', () => {
    expect(buildCodes([], window).codes).toEqual([]);
  });
});

describe('whatFailedRows', () => {
  it('collapses out of scope codes into one other row at the bottom', () => {
    const table = whatFailedRows(buildCodes(rows, window).codes);
    expect(table.map((row) => row.code)).toEqual([
      'op_underfunded',
      'op_over_source_max',
      'op_no_trust',
      'other',
    ]);
    expect(table.at(-1)).toMatchObject({
      count: 5,
      share: 0.125,
      grouped: ['contract_trapped_x', 'op_line_full'],
    });
  });

  it('adds no other row when every code is known', () => {
    const known = buildCodes(rows.slice(0, 2), window).codes;
    expect(whatFailedRows(known).map((row) => row.code)).not.toContain('other');
  });
});

describe('payloads', () => {
  it('renames close time to time in the feed', () => {
    const [row] = buildRecent(
      [
        {
          ledger: 200,
          closeTime: '2026-10-21T12:00:00.000Z',
          txHash: 'ab',
          source: 'G1',
          code: 'op_underfunded',
          bucket: 'preventable',
        },
      ],
      window,
    ).failures;
    expect(row).toEqual({
      ledger: 200,
      time: '2026-10-21T12:00:00.000Z',
      txHash: 'ab',
      source: 'G1',
      code: 'op_underfunded',
      bucket: 'preventable',
    });
  });

  it('drops the scf project from contracts', () => {
    const payload = buildContracts(
      [
        {
          contract: 'C1',
          status: 'archived',
          invocations: 300,
          liveUntilLedger: null,
          daysLeft: null,
          fixCostXlm: 1.5,
          scfProject: 'x',
        },
      ],
      'archived',
      null,
      window,
    );
    expect(payload.contracts[0]).not.toHaveProperty('scfProject');
    expect(payload).toMatchObject({ status: 'archived', endLedger: 200 });
  });

  it('reads the window ledgers from a stored snapshot', () => {
    const payload = buildSnapshot('2026-10-20', { summary: { startLedger: 1, endLedger: 9 } }, now);
    expect(payload).toMatchObject({ startLedger: 1, endLedger: 9, date: '2026-10-20' });
    expect(buildSnapshot('2026-10-20', 'odd', now).startLedger).toBeNull();
  });

  it('builds the agent report with the top codes', () => {
    const report = buildMainnetReport(buildSummary(summary, now), buildCodes(rows, window));
    expect(report.summary).toMatchObject({ failed: 40, contracts: null });
    expect(report.topCodes[0]).toEqual({
      code: 'op_underfunded',
      bucket: 'preventable',
      count: 20,
      share: 0.5,
      fix: 'Top up the sending account from treasury before paying.',
    });
  });
});
