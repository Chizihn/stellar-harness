import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ApiSection } from '@/components/report/api-section';
import { ContractsSection } from '@/components/report/contracts-section';
import { LastDay } from '@/components/report/last-day';
import { LiveFeed } from '@/components/report/live-feed';
import { LiveLine } from '@/components/report/live-line';
import { Section, Waiting } from '@/components/report/section';
import { WAITING_LEDGERS } from '@/components/report/terms';
import { TopAccounts } from '@/components/report/top-accounts';
import { Wordmark } from '@/components/wordmark';
import { getReport } from '@/lib/live';
import { yesterdayUtc } from '@/lib/live-view';

export const dynamic = 'force-dynamic';

const TITLE = 'Stellar Harness mainnet operations report';
const DESCRIPTION =
  'Live failed transactions and contract expiry on Stellar mainnet, with what an ops agent would fix.';
const CONTACT = 'emmanuelodii80@gmail.com';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
};

const NAV = [
  ['last-24-hours', 'Last 24 hours'],
  ['live-feed', 'Live feed'],
  ['contracts', 'Contracts'],
  ['api', 'API'],
] as const;

const LINK = 'underline decoration-border underline-offset-2 hover:decoration-foreground';

const requestOrigin = async (): Promise<string> => {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
};

export default async function ReportPage() {
  const [report, origin] = await Promise.all([getReport(), requestOrigin()]);
  const yesterday = yesterdayUtc(Date.parse(report.summary.generatedAt));
  const snapshotPath = `/api/v1/snapshots/${yesterday}`;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-sm">
      <header className="space-y-4">
        <Wordmark className="font-mono text-sm" />
        <div className="space-y-2">
          <h1 className="text-2xl font-medium">Mainnet operations report</h1>
          <p className="text-muted-foreground">
            What is breaking on Stellar mainnet right now, and what Stellar Harness would do about
            it.
          </p>
        </div>
        <LiveLine initial={report.summary} />
        <nav aria-label="Sections" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </header>
      <Section id="last-24-hours" title="Last 24 hours">
        <LastDay initial={report.summary} rows={report.whatFailed} />
      </Section>
      <Section id="live-feed" title="Live feed">
        <LiveFeed initial={report.recent} />
      </Section>
      <Section id="contracts" title="Contracts">
        <ContractsSection
          archived={report.archived}
          expiring={report.expiring}
          checkedAt={report.summary.contracts?.checkedAt ?? null}
        />
      </Section>
      <Section id="top-accounts" title="Top accounts">
        {report.summary.endLedger === null ? (
          <Waiting>{WAITING_LEDGERS}</Waiting>
        ) : (
          <TopAccounts rows={report.accounts} />
        )}
      </Section>
      <Section id="api" title="API">
        <ApiSection origin={origin} yesterday={yesterday} />
      </Section>
      <footer className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t pt-6 font-mono text-xs text-muted-foreground">
        <span>
          Daily snapshots:{' '}
          <a href={snapshotPath} className={LINK}>
            {snapshotPath}
          </a>
        </span>
      </footer>
    </main>
  );
}
