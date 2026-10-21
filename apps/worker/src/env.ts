import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_RPC_URL } from '@harness/chain';
import { defineEnv, envInt, envUrl } from '@harness/schema';
import { z } from 'zod';

const ROOT_ENV = resolve(import.meta.dirname, '../../../.env');

export const loadEnv = () => {
  if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);
  return defineEnv({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    RPC_URL: envUrl(DEFAULT_RPC_URL),
    SIMULATION_SOURCE: z
      .string()
      .regex(/^G[A-Z2-7]{55}$/, 'SIMULATION_SOURCE must be a public account id')
      .default('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
    POLL_SECONDS: envInt(5),
    PORT: envInt(8787),
  });
};
