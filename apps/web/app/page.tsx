import { cookies } from 'next/headers';
import type * as React from 'react';
import { Suspense } from 'react';
import { ChatPage } from '@/components/chat-page';
import { ExplainerStrip } from '@/components/explainer-strip';
import { Header } from '@/components/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { WatchPanel } from '@/components/watch-panel';
import { EXPLAINER_COOKIE, EXPLAINER_DISMISSED } from '@/lib/explainer';
import { ORG, readWatch } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [watch, jar] = await Promise.all([readWatch(), cookies()]);
  const explainerDismissed = jar.get(EXPLAINER_COOKIE)?.value === EXPLAINER_DISMISSED;
  return (
    <div className="flex h-svh flex-col">
      {!explainerDismissed && <ExplainerStrip network={ORG.network} />}
      <SidebarProvider
        className="relative min-h-0 flex-1"
        style={{ '--sidebar-width': '280px' } as React.CSSProperties}
      >
        <WatchPanel watch={watch} org={ORG} />
        <SidebarInset className="min-h-0 min-w-0">
          <Header />
          <Suspense>
            <ChatPage />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
