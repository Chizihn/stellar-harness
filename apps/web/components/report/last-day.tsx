'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type * as React from 'react';
import { DataTable } from '@/components/data-table';
import { HintTerm } from '@/components/hint';
import type { WhatFailedRow } from '@/lib/live';
import type { SummaryPayload } from '@/lib/live-schemas';
import { formatCount, formatShare, formatUsd, formatXlm } from '@/lib/live-view';
import { HarnessTag, Reason, Waiting } from './section';
import { TERMS, WAITING_LEDGERS } from './terms';
import { useLiveSummary } from './use-live';

function Figure({
  value,
  label,
  note,
}: {
  value: string;
  label: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="font-display text-5xl leading-none tabular-nums">{value}</p>
      <p className="text-sm">{label}</p>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

const GROUPED_SHOWN = 5;

const otherHint = (row: WhatFailedRow): string => {
  if (row.grouped.length === 0) return row.plain;
  const more = row.grouped.length - GROUPED_SHOWN;
  const codes = row.grouped.slice(0, GROUPED_SHOWN).join(', ');
  return `${row.plain} Codes: ${codes}${more > 0 ? `, and ${more} more` : ''}.`;
};

const COLUMNS: ColumnDef<WhatFailedRow>[] = [
  {
    accessorKey: 'code',
    header: 'reason',
    enableSorting: false,
    cell: ({ row }) => (
      <Reason
        code={row.original.code}
        plain={otherHint(row.original)}
        phonePlain={row.original.plain}
      />
    ),
  },
  {
    accessorKey: 'count',
    header: 'count',
    enableSorting: false,
    cell: ({ row }) => formatCount(row.original.count),
  },
  {
    accessorKey: 'share',
    header: 'share',
    enableSorting: false,
    cell: ({ row }) => formatShare(row.original.share),
  },
  {
    id: 'harness',
    header: 'harness',
    enableSorting: false,
    cell: ({ row }) => <HarnessTag bucket={row.original.bucket} fix={row.original.fix} />,
  },
];

function ContractsFigure({ contracts }: { contracts: SummaryPayload['contracts'] }) {
  const label = (
    <>
      <HintTerm hint={TERMS.active}>active</HintTerm> contracts{' '}
      <HintTerm hint={TERMS.archived}>archived</HintTerm> or{' '}
      <HintTerm hint={TERMS.expiring}>expiring</HintTerm>
    </>
  );
  if (!contracts) return <Figure value="–" label={label} note="Waiting for the first check." />;
  return (
    <Figure
      value={formatCount(contracts.archived + contracts.expiring30d)}
      label={label}
      note={
        <>
          <HintTerm hint={TERMS.fixCost}>{formatXlm(contracts.fixCostXlm)} XLM</HintTerm>
          {contracts.fixCostUsd !== null && ` (~$${formatUsd(contracts.fixCostUsd)})`} to keep them
          alive for {formatCount(contracts.extendDays)} days
        </>
      }
    />
  );
}

export function LastDay({ initial, rows }: { initial: SummaryPayload; rows: WhatFailedRow[] }) {
  const summary = useLiveSummary(initial);
  if (summary.endLedger === null) return <Waiting>{WAITING_LEDGERS}</Waiting>;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        <Figure
          value={formatCount(summary.preventable)}
          label={
            <>
              failures a check would have <HintTerm hint={TERMS.preventable}>prevented</HintTerm>
            </>
          }
          note={`of ${formatCount(summary.failed)} failed transactions`}
        />
        <Figure
          value={formatCount(summary.retryable)}
          label={
            <>
              failures that could be <HintTerm hint={TERMS.retryable}>retried</HintTerm> and
              completed
            </>
          }
          note="price moved, fee too low, and similar"
        />
        <ContractsFigure contracts={summary.contracts} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">What failed</h3>
        <DataTable
          columns={COLUMNS}
          data={rows}
          getRowId={(row) => row.code}
          emptyState={<Waiting>No failed transactions in the last 24 hours.</Waiting>}
        />
      </div>
    </div>
  );
}
