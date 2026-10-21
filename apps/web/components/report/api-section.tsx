import { CopyButton } from '@/components/copy-button';
import { CACHE_SECONDS } from '@/lib/live-schemas';

const apiEndpoints = (yesterday: string) => [
  {
    path: '/api/v1/summary',
    description: 'Totals for the last 24 hours, the contracts summary and how far behind it is.',
  },
  {
    path: '/api/v1/codes',
    description: 'Each failure code in the last 24 hours with its count, share and fix.',
  },
  {
    path: '/api/v1/failures/recent?limit=50',
    description: 'The newest failed transactions, up to 100.',
  },
  {
    path: '/api/v1/accounts/top?limit=25',
    description: 'Accounts with the most preventable and retryable failures.',
  },
  {
    path: '/api/v1/contracts?status=archived',
    description: 'Active contracts archived, or expiring with status=expiring, and the fix cost.',
  },
  {
    path: `/api/v1/snapshots/${yesterday}`,
    description: 'The stored summary for one UTC day.',
  },
];

export function ApiSection({ origin, yesterday }: { origin: string; yesterday: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Read-only JSON, open to any origin, cached for {CACHE_SECONDS} seconds.
      </p>
      <ul className="divide-y border-y">
        {apiEndpoints(yesterday).map(({ path, description }) => {
          const curl = `curl ${origin}${path}`;
          return (
            <li key={path} className="space-y-1.5 py-3">
              <p className="font-mono text-xs">
                GET{' '}
                <a
                  href={path}
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                >
                  {path.split('?')[0]}
                </a>
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-xs whitespace-nowrap">
                  {curl}
                </code>
                <CopyButton value={curl} label={`Copy curl for ${path.split('?')[0]}`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
