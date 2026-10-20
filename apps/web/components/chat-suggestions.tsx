'use client';

import { cn } from 'cn';
import { Suggestion } from '@/components/ai-elements/suggestion';

export type ChatPrompt = { label: string; prompt: string };

export const SUGGESTIONS: ChatPrompt[] = [
  {
    label: 'What needs fixing right now?',
    prompt:
      "Check the demo company's accounts and contracts and list what needs fixing, with the cost of each fix.",
  },
  {
    label: 'Why would a USDC payout fail?',
    prompt:
      'Would a 1 USDC payment from Treasury to Distribution succeed? If not, why, and what is the fix?',
  },
  {
    label: 'When does Escrow expire?',
    prompt:
      'When does the Escrow contract expire, and what does it cost to keep it alive as long as the network allows?',
  },
  {
    label: 'What broke on mainnet today?',
    prompt:
      'Summarise what failed on Stellar mainnet in the last 24 hours and which failures the harness would fix.',
  },
];

export interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
  suggestions?: ChatPrompt[];
  disabled?: boolean;
  className?: string;
}

export function ChatSuggestions({
  onSelect,
  suggestions = SUGGESTIONS,
  disabled,
  className,
}: ChatSuggestionsProps) {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {suggestions.map(({ label, prompt }) => (
        <Suggestion
          key={label}
          suggestion={prompt}
          onClick={onSelect}
          disabled={disabled}
          className="h-auto justify-start rounded-md px-3 py-2 text-left text-sm font-normal whitespace-normal"
        >
          {label}
        </Suggestion>
      ))}
    </div>
  );
}
