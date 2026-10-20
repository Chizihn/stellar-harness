import type { Metadata } from 'next';
import Link from 'next/link';
import { DEMO_ORG } from '@/demo-org';
import { REPO_URL } from '@/lib/links';

export const metadata: Metadata = { title: 'How Stellar Harness works' };

const STEPS = [
  'Connect the accounts and contracts your business runs on Stellar.',
  'The harness watches them and catches problems before your customers do: a contract about to expire, a payment that would fail, an account running low.',
  'It prepares the fix and shows what it costs.',
  'It runs the fix within spending rules you set on-chain. Anything above your limit needs your approval with a passkey.',
];

const LINK_CLASS = 'underline underline-offset-4 hover:text-muted-foreground';

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-12 text-sm leading-relaxed">
      <Link
        href="/"
        className="block font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        ← back to the demo
      </Link>
      <h1 className="text-lg font-medium">How it works</h1>
      <ol className="list-decimal space-y-3 pl-5">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-muted-foreground">
        This demo does steps 1 to 3 on {DEMO_ORG.network}. Step 4 is being built.
      </p>
      <p className="flex gap-6">
        <Link href="/report" className={LINK_CLASS}>
          See the mainnet report
        </Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          Source on GitHub
        </a>
      </p>
    </main>
  );
}
