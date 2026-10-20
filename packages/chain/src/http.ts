import type { z } from 'zod';

export const USER_AGENT = 'stellar-harness/0.2 (+https://github.com/devodii/stellar-harness)';

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const retryAfterMs = (header: string | null): number | null => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> => {
  const attempts = options.attempts ?? 6;
  const baseDelay = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;
  const headers = { ...(init.headers as Record<string, string>), 'user-agent': USER_AGENT };
  let lastError: unknown;
  let wait = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(wait);
    wait = Math.min(30_000, baseDelay * 2 ** attempt);
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, headers });
    } catch (error) {
      lastError = error;
      continue;
    }
    if (response.status !== 429 && response.status < 500) return response;
    lastError = new HttpError(
      `${new URL(url).host} returned HTTP ${response.status}`,
      response.status,
    );
    const asked = retryAfterMs(response.headers.get('retry-after'));
    if (asked !== null) wait = Math.min(60_000, asked);
  }
  throw lastError instanceof Error ? lastError : new HttpError(`${url} failed`);
};

export const getJson = async <T>(
  fetchImpl: typeof fetch,
  url: string,
  schema: z.ZodType<T>,
  options?: RetryOptions,
): Promise<T> => {
  const response = await fetchWithRetry(
    fetchImpl,
    url,
    { headers: { accept: 'application/json' } },
    options,
  );
  if (!response.ok)
    throw new HttpError(`GET ${url} returned HTTP ${response.status}`, response.status);
  return schema.parse(await response.json());
};
