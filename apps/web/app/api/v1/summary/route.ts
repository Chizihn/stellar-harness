import { ok } from '@harness/schema';
import { apiHandler, createOptionsHandler } from '@/lib/api-handler';
import { getSummary, PUBLIC_API } from '@/lib/live';

export const dynamic = 'force-dynamic';

export const GET = apiHandler({
  name: 'v1.summary',
  ...PUBLIC_API,
  handler: async () => ok(await getSummary()),
});

export const OPTIONS = createOptionsHandler();
