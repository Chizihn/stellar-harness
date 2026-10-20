import { cn } from 'cn';
import type * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface HintProps {
  hint: React.ReactNode;
  children: React.ReactElement;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
}

export function Hint({ hint, children, side }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

export interface HintTermProps extends Omit<HintProps, 'children'> {
  children: React.ReactNode;
  className?: string;
}

export function HintTerm({ hint, side, children, className }: HintTermProps) {
  return (
    <Hint hint={hint} side={side}>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the explanation for keyboard users
        tabIndex={0}
        className={cn(
          'cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
      >
        {children}
      </span>
    </Hint>
  );
}
