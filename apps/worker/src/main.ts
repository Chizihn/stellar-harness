import { setTimeout as sleep } from 'node:timers/promises';
import { createRpc } from '@harness/chain';
import { createSql, migrate } from '@harness/storage/pg';
import { serve } from '@hono/node-server';
import { loadEnv } from './env';
import { type Health, healthApp } from './health';
import { logger } from './log';
import { catchUp, type Deps, runContracts, sqlStore, TX_CURSOR, writeSnapshotIfDue } from './run';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const KEEP_HOURS = 48;

const env = loadEnv();
const sql = createSql(env.DATABASE_URL);
const deps: Deps = { rpc: createRpc(env.RPC_URL), store: sqlStore(sql), log: logger };
const stop = new AbortController();

const applied = await migrate(sql);
logger.info({ applied }, 'migrations applied');

const health: Health = {
  cursorLedger: await deps.store.readCursor(TX_CURSOR),
  latestLedger: null,
  lastWriteAt: null,
};
let caughtUp = false;

const every = async (name: string, ms: number, task: () => Promise<unknown>) => {
  while (!stop.signal.aborted) {
    try {
      await task();
    } catch (error) {
      logger.error({ err: error }, `${name} failed`);
    }
    await sleep(ms, undefined, { signal: stop.signal }).catch(() => {});
  }
};

const syncTxs = async () => {
  await catchUp(deps, {
    signal: stop.signal,
    onLatest: (ledger) => {
      health.latestLedger = ledger;
    },
    onBatch: (ledger) => {
      health.cursorLedger = ledger;
      health.lastWriteAt = new Date().toISOString();
    },
  });
  caughtUp = !stop.signal.aborted;
};

const everyMinute = async () => {
  const { cursorLedger, latestLedger } = health;
  const lag = cursorLedger === null || latestLedger === null ? null : latestLedger - cursorLedger;
  logger.info({ cursorLedger, latestLedger, lagLedgers: lag }, 'lag');
  if (!caughtUp) return;
  const date = await writeSnapshotIfDue(deps);
  if (date) logger.info({ date }, 'daily snapshot written');
};

const everyHour = async () => {
  const pruned = await deps.store.pruneLedgers(KEEP_HOURS);
  logger.info({ pruned }, 'old ledgers pruned');
  await runContracts({ ...deps, simulationSource: env.SIMULATION_SOURCE });
};

const server = serve({ fetch: healthApp(() => health).fetch, port: env.PORT }, (info) =>
  logger.info({ port: info.port }, 'worker listening'),
);

const loops = [
  every('transactions', env.POLL_SECONDS * 1000, syncTxs),
  every('minute tasks', MINUTE_MS, everyMinute),
  every('hourly tasks', HOUR_MS, everyHour),
];

const shutdown = async (signal: string) => {
  if (stop.signal.aborted) return;
  logger.info({ signal }, 'shutting down');
  stop.abort();
  server.close();
  await Promise.race([Promise.allSettled(loops), sleep(10_000)]);
  await sql.end({ timeout: 5 });
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
