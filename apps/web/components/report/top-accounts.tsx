'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { ExplorerLink } from '@/components/explorer-link';
import type { TopAccount } from '@/lib/live-schemas';
import { formatCount } from '@/lib/live-view';
import { Reason, Waiting } from './section';

const PAGE_SIZE = 10;

const COLUMNS: ColumnDef<TopAccount>[] = [
  {
    accessorKey: 'account',
    header: 'account',
    enableSorting: false,
    cell: ({ row }) => <ExplorerLink kind="account" id={row.original.account} />,
  },
  {
    accessorKey: 'preventable',
    header: 'preventable',
    cell: ({ row }) => formatCount(row.original.preventable),
  },
  {
    accessorKey: 'retryable',
    header: 'retryable',
    cell: ({ row }) => formatCount(row.original.retryable),
  },
  {
    accessorKey: 'dominantCode',
    header: 'main reason',
    enableSorting: false,
    cell: ({ row }) => <Reason code={row.original.dominantCode} plain={row.original.plain} />,
  },
];

export function TopAccounts({ rows }: { rows: TopAccount[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      getRowId={(row) => row.account}
      clientPageSize={PAGE_SIZE}
      emptyState={<Waiting>No preventable or retryable failures in the last 24 hours.</Waiting>}
    />
  );
}
