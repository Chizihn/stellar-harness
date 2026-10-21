import Link from 'next/link';
import { formatCount } from '@/lib/live-view';

export interface MainnetProofProps {
  preventable: number;
  failed: number;
}

export function MainnetProof({ preventable, failed }: MainnetProofProps) {
  return (
    <p className="text-sm">
      {failed > 0 && (
        <span>
          In the last 24 hours on Stellar mainnet,{' '}
          <span className="font-mono font-medium">{formatCount(preventable)}</span> of{' '}
          {formatCount(failed)} failed transactions could have been prevented by a check.{' '}
        </span>
      )}
      <Link href="/report" className="underline underline-offset-4 hover:text-muted-foreground">
        {failed > 0 ? 'See the live report' : 'See what is failing on Stellar mainnet right now'}
      </Link>
    </p>
  );
}
