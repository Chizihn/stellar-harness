import pino from 'pino';

export const logger = pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' });

export type Log = Pick<pino.Logger, 'info' | 'warn' | 'error'>;
