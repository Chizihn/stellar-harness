import { parseArgs } from 'node:util';

export type ScanCommand =
  { command: 'txs'; from: number; to: number } | { command: 'contracts' } | { command: 'all' };

const USAGE = [
  'usage:',
  '  pnpm scan txs --from <ledger> --to <ledger>',
  '  pnpm scan contracts',
  '  pnpm scan all',
].join('\n');

const ledger = (name: string, value: string | undefined): number => {
  const parsed = Number(value);
  if (value === undefined || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a ledger number\n${USAGE}`);
  }
  return parsed;
};

export const parseScanArgs = (argv: string[]): ScanCommand => {
  const { positionals, values } = parseArgs({
    args: argv.filter((arg) => arg !== '--'),
    allowPositionals: true,
    options: { from: { type: 'string' }, to: { type: 'string' } },
  });
  const [command, ...rest] = positionals;
  if (rest.length > 0) throw new Error(USAGE);
  if (command === 'txs') {
    const from = ledger('from', values.from);
    const to = ledger('to', values.to);
    if (from > to) throw new Error(`--from must not be after --to\n${USAGE}`);
    return { command, from, to };
  }
  if ((command === 'contracts' || command === 'all') && !values.from && !values.to) {
    return { command };
  }
  throw new Error(USAGE);
};
