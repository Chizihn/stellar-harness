'use client';

import { cn } from 'cn';
import { ChatSuggestions } from '@/components/chat-suggestions';

export const INTRO_TITLE = 'Ask the harness about the demo company.';
const INTRO_BODY =
  'It can check balances, find contracts close to expiring, explain why a payment would fail, and work out what a fix costs. It shows its work and does not move any money in this demo.';

export interface ChatIntroProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatIntro({ onSelect, disabled, className }: ChatIntroProps) {
  return (
    <div className={cn('w-full max-w-2xl space-y-5', className)}>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{INTRO_TITLE}</h2>
        <p className="text-sm text-muted-foreground">{INTRO_BODY}</p>
      </div>
      <ChatSuggestions onSelect={onSelect} disabled={disabled} />
    </div>
  );
}
