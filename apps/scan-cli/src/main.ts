import { createRpc } from '@harness/chain';
import { createSql, migrate } from '@harness/storage/pg';
import { loadEnv } from 'worker/env';
import { logger } from 'worker/log';
import { catchUp, type Deps, runContracts, sqlStore, syncLedgers } from 'worker/run';
import { parseScanArgs } from './args';

const SCAN_CURSOR = 'scan';

const args = (() => {
  try {
    return parseScanArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();

const env = loadEnv();
const sql = createSql(env.DATABASE_URL);
const deps: Deps = { rpc: createRpc(env.RPC_URL), store: sqlStore(sql), log: logger };

try {
  await migrate(sql);
  if (args.command === 'txs') {
    const result = await syncLedgers(deps, args, SCAN_CURSOR);
    logger.info(result, 'ledgers written');
  } else {
    if (args.command === 'all') logger.info(await catchUp(deps), 'ledgers written');
    await runContracts({ ...deps, simulationSource: env.SIMULATION_SOURCE });
  }
} catch (error) {
  logger.error({ err: error }, `scan ${args.command} failed`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
