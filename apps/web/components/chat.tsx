'use client';

import { useChat } from '@ai-sdk/react';
import type { HarnessMessage } from '@harness/agent';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ActionCard } from '@/components/action-card';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { ChatComposer } from '@/components/chat-composer';
import { ChatIntro } from '@/components/chat-intro';
import { InlineAlert } from '@/components/inline-alert';
import { isToolCallPart, ToolSteps } from '@/components/tool-call';

type Part = HarnessMessage['parts'][number];

function AssistantParts({ parts }: { parts: Part[] }) {
  const tools = parts.filter(isToolCallPart);
  const actions = tools.flatMap((part) =>
    part.type === 'tool-proposeAction' && part.state === 'output-available' ? [part.output] : [],
  );
  return (
    <>
      {parts.map((part, index) =>
        part.type === 'text' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: message parts are append-only
          <MessageResponse key={index} className="text-base leading-relaxed">
            {part.text}
          </MessageResponse>
        ) : null,
      )}
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
      {tools.length > 0 && <ToolSteps parts={tools} />}
    </>
  );
}

function UserParts({ parts }: { parts: Part[] }) {
  return parts.map((part, index) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: message parts are append-only
    part.type === 'text' ? <p key={index}>{part.text}</p> : null,
  );
}

export interface ChatProps {
  id: string;
  initialMessages?: HarnessMessage[];
  onMessagesChange?: (messages: HarnessMessage[]) => void;
}

export function Chat({ id, initialMessages = [], onMessagesChange }: ChatProps) {
  const router = useRouter();
  const { messages, sendMessage, status, stop, error } = useChat<HarnessMessage>({
    id,
    messages: initialMessages,
    onFinish: () => router.refresh(),
  });

  const onChangeRef = React.useRef(onMessagesChange);
  onChangeRef.current = onMessagesChange;
  React.useEffect(() => {
    if (messages.length > 0 && status !== 'streaming') onChangeRef.current?.(messages);
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';
  const send = (text: string) => void sendMessage({ text });

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 overflow-y-auto p-6">
          <ChatIntro onSelect={send} disabled={busy} className="m-auto" />
        </div>
      ) : (
        <Conversation className="min-h-0">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === 'user' ? (
                    <UserParts parts={message.parts} />
                  ) : (
                    <AssistantParts parts={message.parts} />
                  )}
                </MessageContent>
              </Message>
            ))}
            {status === 'submitted' && (
              <Shimmer as="p" className="font-mono text-xs">
                working…
              </Shimmer>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}
      <div className="mx-auto w-full max-w-3xl space-y-2 px-4 pb-4">
        {error && (
          <InlineAlert tone="destructive" title="Chat request failed">
            {error.message}
          </InlineAlert>
        )}
        <ChatComposer onSubmit={send} onStop={() => void stop()} status={status} disabled={busy} />
      </div>
    </main>
  );
}
