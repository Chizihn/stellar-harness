import 'server-only';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineEnv } from '@harness/schema';
import { z } from 'zod';
import { memo } from './memo';

const serverShape = {
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
};

const chatShape = {
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for /api/chat'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1'),
};

const dbShape = {
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required to store pilot requests'),
};

const loadRootEnv = memo(() => {
  const rootEnv = resolve(process.cwd(), '../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
});

export const getServerEnv = memo(() => {
  loadRootEnv();
  return defineEnv(serverShape);
});

export const getChatEnv = memo(() => ({ ...getServerEnv(), ...defineEnv(chatShape) }));

export const getDbEnv = memo(() => ({ ...getServerEnv(), ...defineEnv(dbShape) }));
