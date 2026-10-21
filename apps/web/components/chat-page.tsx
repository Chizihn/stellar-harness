'use client';

import type { HarnessMessage } from '@harness/agent';
import { generateId } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Chat } from '@/components/chat';
import { useConversations } from '@/components/conversations-provider';
import { useMounted } from '@/hooks/use-mounted';
import { chatHref, newConversation, sameMessages, withMessages } from '@/lib/conversations';

export function ChatPage({ welcome }: { welcome?: React.ReactNode }) {
  const router = useRouter();
  const store = useConversations();
  const mounted = useMounted();
  const paramId = useSearchParams().get('c');
  const [freshId] = React.useState(generateId);
  const id = paramId ?? freshId;

  const persist = React.useCallback(
    (messages: HarnessMessage[]) => {
      const base = store.get(id) ?? newConversation(id);
      if (sameMessages(base.messages, messages)) return;
      store.save(withMessages(base, messages));
      if (paramId !== id) router.replace(chatHref(id), { scroll: false });
    },
    [store, id, paramId, router],
  );

  if (!mounted) return <main className="flex-1" />;
  return (
    <Chat
      welcome={welcome}
      key={id}
      id={id}
      initialMessages={store.get(id)?.messages ?? []}
      onMessagesChange={persist}
    />
  );
}
