import type { AccountView, ContractTtl, EntryTtl, Preflight } from '@harness/stellar-tools';
import { BracketTag } from '@/components/bracket-tag';
import { KeyValueList } from '@/components/key-value-list';
import { formatDecimal, truncateMiddle } from '@/lib/format';

export function AccountResult({ account }: { account: AccountView }) {
  if (!account.exists) {
    return <p className="font-mono text-xs">{truncateMiddle(account.address)} does not exist</p>;
  }
  return (
    <KeyValueList
      columns={1}
      items={[
        { label: 'balance', value: `${formatDecimal(Number(account.xlm ?? 0), 2)} XLM` },
        { label: 'sequence', value: account.sequence },
        { label: 'signers', value: account.signers },
        ...(account.trustlines.length === 0
          ? [{ label: 'trustlines', value: 'none' }]
          : account.trustlines.map((line) => {
              const [code = line.asset, issuer = ''] = line.asset.split(':');
              return {
                label: code,
                value: `${formatDecimal(Number(line.balance), 2)}, issued by ${truncateMiddle(issuer)}`,
              };
            })),
      ]}
    />
  );
}

const entryValue = (entry: EntryTtl | null) => {
  if (!entry) return 'unknown';
  if (entry.archived) return <BracketTag label="archived" tone="default" emphasis />;
  return `${formatDecimal(entry.daysLeft, 1)} days left`;
};

export function ContractTtlResult({ ttl }: { ttl: ContractTtl }) {
  return (
    <KeyValueList
      columns={1}
      items={[
        { label: 'instance', value: entryValue(ttl.instance) },
        { label: 'code', value: entryValue(ttl.code) },
        { label: 'wasm', value: ttl.wasmHash ? truncateMiddle(ttl.wasmHash, 6, 6) : 'unknown' },
      ]}
    />
  );
}

export function PreflightResult({ preflight }: { preflight: Preflight }) {
  if (preflight.ok) return <BracketTag label="ok" />;
  return (
    <ul className="space-y-1 font-mono text-xs">
      {preflight.blockers.map((blocker) => (
        <li key={blocker.code}>
          {blocker.code}: {blocker.plain}. To fix it, {blocker.fix}.
        </li>
      ))}
    </ul>
  );
}
