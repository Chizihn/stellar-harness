'use client';

import { cn } from 'cn';
import { Suggestion } from '@/components/ai-elements/suggestion';

export const SUGGESTIONS = [
  'Check all our contracts and tell me which need attention',
  'Can we pay 25 USDC from treasury to distribution right now?',
  'What would it cost to keep Escrow alive for six months?',
];

export interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
  suggestions?: string[];
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
      {suggestions.map((suggestion) => (
        <Suggestion
          key={suggestion}
          suggestion={suggestion}
          onClick={onSelect}
          disabled={disabled}
          className="h-auto justify-start rounded-md px-3 py-2 text-left text-xs font-normal whitespace-normal"
        >
          {suggestion}
        </Suggestion>
      ))}
    </div>
  );
}
