import { ok } from '@harness/schema';
import { apiHandler, createOptionsHandler } from '@/lib/api-handler';
import { getTopAccounts, PUBLIC_API } from '@/lib/live';
import { TopAccountsQuery } from '@/lib/live-schemas';

export const dynamic = 'force-dynamic';

export const GET = apiHandler({
  name: 'v1.accounts.top',
  ...PUBLIC_API,
  schema: { query: TopAccountsQuery },
  handler: async ({ query }) => ok(await getTopAccounts(query.limit)),
});

export const OPTIONS = createOptionsHandler();
