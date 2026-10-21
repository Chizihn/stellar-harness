'use client';

import type { Network } from '@harness/schema';
import Link from 'next/link';
import { demoScope, HowItWorksSteps } from '@/components/how-it-works';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Button } from '@/components/ui/button';
import { REPO_URL } from '@/lib/links';

const LINK_CLASS = 'underline underline-offset-4 hover:text-muted-foreground';

export function HowItWorksSheet({ network }: { network: Network }) {
  return (
    <ResponsiveSheet
      title="How it works"
      trigger={
        <Button variant="link" size="sm" className="px-0">
          How it works
        </Button>
      }
    >
      <HowItWorksSteps layout="column" />
      <p className="text-sm text-muted-foreground">{demoScope(network)}</p>
      <p className="flex gap-6 text-sm">
        <Link href="/report" className={LINK_CLASS}>
          See the mainnet report
        </Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          Source on GitHub
        </a>
      </p>
    </ResponsiveSheet>
  );
}
