import { appError, err, ok } from '@harness/schema';
import { apiHandler, createOptionsHandler } from '@/lib/api-handler';
import { getSnapshot, PUBLIC_API } from '@/lib/live';
import { SnapshotParams } from '@/lib/live-schemas';

export const dynamic = 'force-dynamic';

export const GET = apiHandler({
  name: 'v1.snapshots',
  ...PUBLIC_API,
  schema: { params: SnapshotParams },
  handler: async ({ params }) => {
    const snapshot = await getSnapshot(params.date);
    return snapshot ? ok(snapshot) : err(appError('NOT_FOUND', `No snapshot for ${params.date}`));
  },
});

export const OPTIONS = createOptionsHandler();
