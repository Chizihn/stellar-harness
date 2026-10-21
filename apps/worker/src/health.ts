import { Hono } from 'hono';

export type Health = {
  cursorLedger: number | null;
  latestLedger: number | null;
  lastWriteAt: string | null;
};

export const healthApp = (read: () => Health) =>
  new Hono().get('/health', (c) => {
    const { cursorLedger, latestLedger, lastWriteAt } = read();
    const lagLedgers =
      cursorLedger === null || latestLedger === null
        ? null
        : Math.max(0, latestLedger - cursorLedger);
    return c.json({ cursorLedger, latestLedger, lagLedgers, lastWriteAt });
  });
