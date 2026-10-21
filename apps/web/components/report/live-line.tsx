'use client';

import { cn } from 'cn';
import { ExplorerLink } from '@/components/explorer-link';
import { HintTerm } from '@/components/hint';
import type { SummaryPayload } from '@/lib/live-schemas';
import { isDelayed, secondsSince } from '@/lib/live-view';
import { TERMS } from './terms';
import { useLiveSummary, useNow } from './use-live';

function Dot({ live }: { live: boolean }) {
  return (
    <span aria-hidden className="relative flex size-2 shrink-0">
      {live && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-50 motion-reduce:animate-none" />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          live ? 'bg-foreground' : 'bg-muted-foreground/60',
        )}
      />
    </span>
  );
}

export function LiveLine({ initial }: { initial: SummaryPayload }) {
  const summary = useLiveSummary(initial);
  const now = useNow(initial.generatedAt);
  const { endLedger, endCloseTime } = summary;
  const delayed = isDelayed(endCloseTime, now);
  const ledger = <HintTerm hint={TERMS.ledger}>ledger</HintTerm>;

  return (
    <p className="flex items-center gap-2 font-mono text-xs">
      <Dot live={!delayed} />
      {endLedger === null || endCloseTime === null ? (
        <span>waiting for the first {ledger}</span>
      ) : delayed ? (
        <span>
          delayed, last {ledger} <ExplorerLink kind="ledger" id={endLedger} />
        </span>
      ) : (
        <span>
          live, {ledger} <ExplorerLink kind="ledger" id={endLedger} />, updated{' '}
          {secondsSince(endCloseTime, now)}s ago
        </span>
      )}
    </p>
  );
}
