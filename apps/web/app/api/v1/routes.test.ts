import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const window = { generatedAt: '2026-10-21T12:00:00.000Z', startLedger: 1, endLedger: 2 };

vi.mock('@/lib/live', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/live')>()),
  getSummary: vi.fn(async () => ({ ...window, failed: 3 })),
  getCodes: vi.fn(async () => ({ ...window, codes: [] })),
  getRecent: vi.fn(async (limit: number) => ({ ...window, limit, failures: [] })),
  getTopAccounts: vi.fn(async (limit: number) => ({ ...window, limit, accounts: [] })),
  getContracts: vi.fn(async (status: string) => ({ ...window, status, contracts: [] })),
  getSnapshot: vi.fn(async (date: string) =>
    date === '2026-10-20' ? { ...window, date, snapshot: {} } : null,
  ),
}));

const accounts = await import('./accounts/top/route');
const codes = await import('./codes/route');
const contracts = await import('./contracts/route');
const recent = await import('./failures/recent/route');
const snapshots = await import('./snapshots/[date]/route');
const summary = await import('./summary/route');

const call = (
  route: { GET: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown },
  url: string,
  params: Record<string, string> = {},
) =>
  route.GET(
    new NextRequest(new URL(url, 'http://localhost'), {
      headers: { origin: 'https://example.com', 'x-forwarded-for': crypto.randomUUID() },
    }),
    { params: Promise.resolve(params) },
  ) as Promise<Response>;

describe('public api', () => {
  it.each([
    ['summary', summary, '/api/v1/summary'],
    ['codes', codes, '/api/v1/codes'],
    ['recent', recent, '/api/v1/failures/recent'],
    ['accounts', accounts, '/api/v1/accounts/top'],
    ['contracts', contracts, '/api/v1/contracts?status=archived'],
  ])('%s is open to any origin and cached for 15 seconds', async (_, route, url) => {
    const res = await call(route, url);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com');
    expect(res.headers.get('cache-control')).toBe('public, max-age=15');
    expect(res.headers.get('x-ratelimit-limit')).toBe('120');
    expect(await res.json()).toMatchObject(window);
  });

  it('defaults and caps the list limits', async () => {
    expect((await (await call(recent, '/api/v1/failures/recent')).json()).limit).toBe(50);
    expect((await (await call(accounts, '/api/v1/accounts/top')).json()).limit).toBe(25);
    expect((await call(recent, '/api/v1/failures/recent?limit=101')).status).toBe(400);
    expect((await call(accounts, '/api/v1/accounts/top?limit=0')).status).toBe(400);
  });

  it('requires a known contract status', async () => {
    expect((await call(contracts, '/api/v1/contracts')).status).toBe(400);
    expect((await call(contracts, '/api/v1/contracts?status=live')).status).toBe(400);
    const res = await call(contracts, '/api/v1/contracts?status=expiring');
    expect((await res.json()).status).toBe('expiring');
  });

  it('serves a stored snapshot and 404s a missing one', async () => {
    const found = await call(snapshots, '/api/v1/snapshots/2026-10-20', { date: '2026-10-20' });
    expect(found.status).toBe(200);
    expect(found.headers.get('access-control-allow-origin')).toBe('https://example.com');
    const missing = await call(snapshots, '/api/v1/snapshots/2026-10-19', { date: '2026-10-19' });
    expect(missing.status).toBe(404);
    const bad = await call(snapshots, '/api/v1/snapshots/yesterday', { date: 'yesterday' });
    expect(bad.status).toBe(400);
  });

  it('answers the preflight request', async () => {
    const res = summary.OPTIONS(
      new NextRequest('http://localhost/api/v1/summary', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com');
  });
});
