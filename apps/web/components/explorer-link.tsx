import { truncateMiddle } from '@/lib/format';
import { type ExplorerKind, explorerUrl } from '@/lib/links';

export interface ExplorerLinkProps {
  kind: ExplorerKind;
  id: string | number;
  label?: string;
}

export function ExplorerLink({ kind, id, label }: ExplorerLinkProps) {
  const value = String(id);
  const text =
    label ??
    (kind === 'ledger' ? Number(value).toLocaleString('en-US') : truncateMiddle(value, 6, 6));
  return (
    <a
      href={explorerUrl(kind, value, 'mainnet')}
      title={value}
      target="_blank"
      rel="noreferrer"
      className="font-mono underline decoration-border underline-offset-2 hover:decoration-foreground"
    >
      {text}
    </a>
  );
}
