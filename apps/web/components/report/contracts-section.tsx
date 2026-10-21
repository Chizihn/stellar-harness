'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { ExplorerLink } from '@/components/explorer-link';
import { Hint, HintTerm } from '@/components/hint';
import { formatDecimal } from '@/lib/format';
import type { ContractRow } from '@/lib/live-schemas';
import { formatCount, formatUtc, formatXlm } from '@/lib/live-view';
import { Waiting } from './section';
import { TERMS, WAITING_CONTRACTS } from './terms';

const PAGE_SIZE = 10;

function FixCost({ value }: { value: number | null }) {
  if (value !== null) return <>{formatXlm(value)} XLM</>;
  return (
    <Hint hint={TERMS.noCost}>
      <span className="text-muted-foreground">–</span>
    </Hint>
  );
}

const contract: ColumnDef<ContractRow> = {
  accessorKey: 'contract',
  header: 'contract',
  enableSorting: false,
  cell: ({ row }) => <ExplorerLink kind="contract" id={row.original.contract} />,
};

const invocations: ColumnDef<ContractRow> = {
  accessorKey: 'invocations',
  header: 'invocations',
  cell: ({ row }) => formatCount(row.original.invocations),
};

const fixCost: ColumnDef<ContractRow> = {
  accessorKey: 'fixCostXlm',
  header: () => <HintTerm hint={TERMS.contractFixCost}>fix cost</HintTerm>,
  enableSorting: false,
  cell: ({ row }) => <FixCost value={row.original.fixCostXlm} />,
};

const daysLeft: ColumnDef<ContractRow> = {
  accessorKey: 'daysLeft',
  header: () => <HintTerm hint={TERMS.daysLeft}>days left</HintTerm>,
  enableSorting: false,
  cell: ({ row }) =>
    row.original.daysLeft === null ? '–' : formatDecimal(row.original.daysLeft, 1),
};

const ARCHIVED_COLUMNS = [contract, invocations, fixCost];
const EXPIRING_COLUMNS = [contract, invocations, daysLeft, fixCost];

function ContractTable({
  title,
  rows,
  columns,
  empty,
}: {
  title: string;
  rows: ContractRow[];
  columns: ColumnDef<ContractRow>[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        {title} ({formatCount(rows.length)})
      </h3>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.contract}
        clientPageSize={PAGE_SIZE}
        emptyState={<Waiting>{empty}</Waiting>}
      />
    </div>
  );
}

export function ContractsSection({
  archived,
  expiring,
  checkedAt,
}: {
  archived: ContractRow[];
  expiring: ContractRow[];
  checkedAt: string | null;
}) {
  if (checkedAt === null) return <Waiting>{WAITING_CONTRACTS}</Waiting>;
  return (
    <div className="space-y-6">
      <ContractTable
        title="Archived"
        rows={archived}
        columns={ARCHIVED_COLUMNS}
        empty="No active contract is archived."
      />
      <ContractTable
        title="Expiring within 30 days"
        rows={expiring}
        columns={EXPIRING_COLUMNS}
        empty="No active contract expires within 30 days."
      />
      <p className="text-sm text-muted-foreground">
        Active means 100+ lifetime calls or <HintTerm hint={TERMS.scf}>SCF</HintTerm>-funded.
        Checked hourly, last at {formatUtc(checkedAt)}.
      </p>
    </div>
  );
}
