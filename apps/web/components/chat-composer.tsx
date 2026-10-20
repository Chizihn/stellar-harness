'use client';

import type { ChatStatus } from 'ai';
import { cn } from 'cn';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';

export const COMPOSER_PLACEHOLDER = "Ask about the demo company's accounts and contracts";

export interface ChatComposerProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  status?: ChatStatus;
  disabled?: boolean;
  className?: string;
}

export function ChatComposer({
  onSubmit,
  onStop,
  status = 'ready',
  disabled,
  className,
}: ChatComposerProps) {
  return (
    <PromptInput
      className={cn('bg-card', className)}
      onSubmit={(message) => {
        const text = message.text.trim();
        if (text && !disabled) onSubmit(text);
      }}
    >
      <PromptInputBody>
        <PromptInputTextarea placeholder={COMPOSER_PLACEHOLDER} disabled={disabled} />
      </PromptInputBody>
      <PromptInputFooter className="justify-end">
        <PromptInputSubmit status={status} onStop={onStop} disabled={disabled} />
      </PromptInputFooter>
    </PromptInput>
  );
}
