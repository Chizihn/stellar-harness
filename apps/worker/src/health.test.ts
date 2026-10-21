import { describe, expect, it } from 'vitest';
import { healthApp } from './health';

describe('GET /health', () => {
  it('reports the cursor and lag', async () => {
    const app = healthApp(() => ({
      cursorLedger: 90,
      latestLedger: 100,
      lastWriteAt: '2026-10-21T00:00:00.000Z',
    }));
    const response = await app.request('/health');
    expect(await response.json()).toEqual({
      cursorLedger: 90,
      latestLedger: 100,
      lagLedgers: 10,
      lastWriteAt: '2026-10-21T00:00:00.000Z',
    });
  });

  it('reports no lag before the first read', async () => {
    const app = healthApp(() => ({ cursorLedger: null, latestLedger: null, lastWriteAt: null }));
    expect(await (await app.request('/health')).json()).toMatchObject({ lagLedgers: null });
  });
});
