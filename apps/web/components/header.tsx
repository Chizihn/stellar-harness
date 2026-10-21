import type { Network } from '@harness/schema';
import { GithubLogoIcon } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { Hint } from '@/components/hint';
import { HowItWorksSheet } from '@/components/how-it-works-sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Wordmark } from '@/components/wordmark';
import { REPO_URL } from '@/lib/links';

export const WALLET_SOON =
  "Coming soon. Connect your company's Stellar wallet and the harness watches it for you.";

export function Header({ network }: { network: Network }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <Wordmark className="font-mono text-sm" />
      <nav className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button asChild variant="link" size="sm" className="px-0">
          <Link href="/report">Report</Link>
        </Button>
        <HowItWorksSheet network={network} />
        <Hint hint={WALLET_SOON} side="bottom">
          <span className="hidden sm:inline-flex">
            <Button variant="outline" size="sm" disabled>
              Connect wallet
            </Button>
          </span>
        </Hint>
        <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <GithubLogoIcon className="size-4" />
          </a>
        </Button>
        <ThemeToggle />
      </nav>
    </header>
  );
}
