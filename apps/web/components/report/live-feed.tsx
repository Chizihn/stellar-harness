'use client';

import * as React from 'react';
import { ExplorerLink } from '@/components/explorer-link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { truncateMiddle } from '@/lib/format';
import type { RecentPayload } from '@/lib/live-schemas';
import { formatAge, formatUtc, secondsSince } from '@/lib/live-view';
import { HarnessTag, Reason, Waiting } from './section';
import { WAITING_LEDGERS } from './terms';
import { useNow, useRecentFailures } from './use-live';

const HEAD =
  'h-8 px-2 text-xs font-normal tracking-wide text-muted-foreground [font-variant-caps:all-small-caps]';
const CELL = 'px-2 py-1.5 font-mono text-xs';

export function LiveFeed({ initial }: { initial: RecentPayload }) {
  const { failures } = useRecentFailures(initial);
  const now = useNow(initial.generatedAt);
  const [firstSeen] = React.useState(() => new Set(initial.failures.map((row) => row.txHash)));

  if (failures.length === 0) return <Waiting>{WAITING_LEDGERS}</Waiting>;

  return (
    <div className="overflow-x-auto border-y border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD}>time</TableHead>
            <TableHead className={HEAD}>transaction</TableHead>
            <TableHead className={HEAD}>reason</TableHead>
            <TableHead className={HEAD}>harness</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failures.map((row) => (
            <TableRow
              key={row.txHash}
              data-new={firstSeen.has(row.txHash) ? undefined : ''}
              className="data-new:animate-in data-new:fade-in data-new:duration-1000"
            >
              <TableCell className={CELL}>
                <time dateTime={row.time} title={formatUtc(row.time)}>
                  {formatAge(secondsSince(row.time, now))} ago
                </time>
              </TableCell>
              <TableCell className={CELL}>
                <ExplorerLink kind="tx" id={row.txHash} label={truncateMiddle(row.txHash, 4, 4)} />
              </TableCell>
              <TableCell className={CELL}>
                <Reason code={row.code} plain={row.plain} />
              </TableCell>
              <TableCell className={CELL}>
                <HarnessTag bucket={row.bucket} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
