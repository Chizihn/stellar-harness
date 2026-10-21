import { ok } from '@harness/schema';
import { apiHandler, createOptionsHandler } from '@/lib/api-handler';
import { getContracts, PUBLIC_API } from '@/lib/live';
import { ContractsQuery } from '@/lib/live-schemas';

export const dynamic = 'force-dynamic';

export const GET = apiHandler({
  name: 'v1.contracts',
  ...PUBLIC_API,
  schema: { query: ContractsQuery },
  handler: async ({ query }) => ok(await getContracts(query.status)),
});

export const OPTIONS = createOptionsHandler();
