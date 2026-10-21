import { ok } from '@harness/schema';
import { apiHandler, createOptionsHandler } from '@/lib/api-handler';
import { getRecent, PUBLIC_API } from '@/lib/live';
import { RecentQuery } from '@/lib/live-schemas';

export const dynamic = 'force-dynamic';

export const GET = apiHandler({
  name: 'v1.failures.recent',
  ...PUBLIC_API,
  schema: { query: RecentQuery },
  handler: async ({ query }) => ok(await getRecent(query.limit)),
});

export const OPTIONS = createOptionsHandler();
