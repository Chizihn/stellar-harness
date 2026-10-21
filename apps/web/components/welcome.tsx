import type { Network } from '@harness/schema';
import type * as React from 'react';
import { demoScope, HowItWorksSteps } from '@/components/how-it-works';

export const VALUE_LINE =
  "Stellar Harness keeps a business's Stellar accounts and contracts working.";
export const VALUE_DETAIL = "It watches them, catches what's about to break, and prepares the fix.";

export interface WelcomeProps {
  network: Network;
  proof?: React.ReactNode;
}

export function Welcome({ network, proof }: WelcomeProps) {
  return (
    <section aria-labelledby="welcome-title" className="w-full space-y-6">
      <div className="space-y-2">
        <h1 id="welcome-title" className="text-xl font-medium text-balance sm:text-2xl">
          {VALUE_LINE}
        </h1>
        <p className="text-muted-foreground">{VALUE_DETAIL}</p>
      </div>
      <HowItWorksSteps />
      <p className="text-sm text-muted-foreground">{demoScope(network)}</p>
      {proof}
    </section>
  );
}
