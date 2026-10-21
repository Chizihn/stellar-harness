import type { Network } from '@harness/schema';
import { cn } from 'cn';

export const HOW_IT_WORKS_STEPS = [
  {
    title: 'Connect',
    body: 'Connect the accounts and contracts your business runs on Stellar.',
  },
  {
    title: 'Watch',
    body: 'The harness watches them and catches problems before your customers do: a contract about to expire, a payment that would fail, an account running low.',
  },
  {
    title: 'Prepare the fix',
    body: 'It prepares the fix and shows what it costs.',
  },
  {
    title: 'Run it within your rules',
    body: 'It runs the fix within spending rules you set on-chain. Anything above your limit needs your approval with a passkey.',
  },
] as const;

export const demoScope = (network: Network): string =>
  `This demo does steps 1 to 3 on ${network}. Step 4 is being built.`;

export interface HowItWorksStepsProps {
  layout?: 'row' | 'column';
  className?: string;
}

export function HowItWorksSteps({ layout = 'row', className }: HowItWorksStepsProps) {
  return (
    <ol
      className={cn(
        'grid gap-x-6 gap-y-4',
        layout === 'row' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1',
        className,
      )}
    >
      {HOW_IT_WORKS_STEPS.map((step, index) => (
        <li
          key={step.title}
          className={cn(
            'space-y-1 border-t pt-3',
            layout === 'column' && 'first:border-t-0 first:pt-0',
          )}
        >
          <p className="flex items-baseline gap-2 font-medium">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
            {step.title}
          </p>
          <p className="text-sm text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
