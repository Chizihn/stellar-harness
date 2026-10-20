'use client';

import type { Network } from '@harness/schema';
import { XIcon } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EXPLAINER_COOKIE, EXPLAINER_DISMISSED } from '@/lib/explainer';

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export const explainerText = (network: Network): string =>
  `Stellar Harness watches a business's Stellar accounts and contracts, catches what's about to break, and prepares the fix. This is a live demo for a sample company on ${network}.`;

export function ExplainerStrip({ network }: { network: Network }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;

  const dismiss = () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the server reads this cookie so the strip never flashes
    document.cookie = `${EXPLAINER_COOKIE}=${EXPLAINER_DISMISSED}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
    setOpen(false);
  };

  return (
    <aside
      aria-label="About this demo"
      className="flex shrink-0 items-start gap-3 border-b bg-muted/50 px-4 py-2 text-sm"
    >
      <p className="min-w-0 flex-1">
        {explainerText(network)}{' '}
        <Link
          href="/report"
          className="whitespace-nowrap text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          See what&apos;s breaking on mainnet now →
        </Link>
      </p>
      <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Dismiss">
        <XIcon />
      </Button>
    </aside>
  );
}
