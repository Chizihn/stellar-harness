import type * as React from 'react';
import { Suspense } from 'react';
import { ChatPage } from '@/components/chat-page';
import { Header } from '@/components/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { WatchPanel } from '@/components/watch-panel';
import { Welcome } from '@/components/welcome';
import { ORG, readWatch } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const watch = await readWatch();
  return (
    <SidebarProvider
      className="h-svh min-h-0"
      style={{ '--sidebar-width': '280px' } as React.CSSProperties}
    >
      <WatchPanel watch={watch} org={ORG} />
      <SidebarInset className="min-h-0 min-w-0">
        <Header network={ORG.network} />
        <Suspense>
          <ChatPage welcome={<Welcome network={ORG.network} />} />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
