export type Migration = { id: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_pilot_requests',
    sql: `
      create table pilot_requests (
        id bigserial primary key,
        email text not null,
        created_at timestamptz not null default now(),
        user_agent text not null default ''
      );
    `,
  },
  {
    id: '0002_report_files',
    sql: `
      create table report_files (
        name text primary key,
        body text not null,
        sha256 text not null,
        row_count integer not null,
        published_at timestamptz not null default now()
      );
    `,
  },
  {
    id: '0003_live',
    sql: `
      drop table if exists report_files, pilot_requests, waitlist;

      create table cursor (
        name text primary key,
        ledger bigint not null,
        updated_at timestamptz not null default now()
      );

      create table ledger_counts (
        ledger bigint primary key,
        close_time timestamptz not null,
        total int not null,
        failed int not null
      );
      create index ledger_counts_close_time on ledger_counts (close_time);

      create table ledger_code_counts (
        ledger bigint not null,
        code text not null,
        bucket text not null,
        count int not null,
        primary key (ledger, code)
      );

      create table ledger_account_counts (
        ledger bigint not null,
        account text not null,
        bucket text not null,
        count int not null,
        dominant_code text not null
      );
      create index ledger_account_counts_account on ledger_account_counts (account);
      create index ledger_account_counts_ledger on ledger_account_counts (ledger);

      create table recent_failures (
        id bigserial primary key,
        ledger bigint not null,
        close_time timestamptz not null,
        tx_hash text not null,
        source text not null,
        code text not null,
        bucket text not null
      );
      create index recent_failures_ledger on recent_failures (ledger);

      create table contracts (
        contract text primary key,
        status text not null,
        invocations int not null,
        live_until_ledger bigint,
        days_left numeric,
        fix_cost_xlm numeric,
        scf_project text,
        checked_at timestamptz not null
      );

      create table contracts_meta (
        checked_at timestamptz not null,
        archived int not null,
        expiring30d int not null,
        fix_cost_xlm numeric not null,
        fix_cost_usd numeric,
        simulated int not null,
        simulation_failed int not null,
        xlm_usd numeric,
        price_source text,
        price_time timestamptz,
        extend_days int not null
      );

      create table daily_snapshots (
        date date primary key,
        json jsonb not null
      );

      create table active_contracts (
        contract text primary key,
        invocations int not null,
        scf_project text,
        refreshed_at timestamptz not null default now()
      );
    `,
  },
];
