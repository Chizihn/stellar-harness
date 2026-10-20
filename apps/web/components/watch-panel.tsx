import type { Org } from '@harness/schema';
import * as React from 'react';
import { ActionCard } from '@/components/action-card';
import { Address } from '@/components/address';
import { BracketTag } from '@/components/bracket-tag';
import { NewChatButton, SidebarChats } from '@/components/chat-list';
import { StatLabel } from '@/components/stat';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { formatDecimal } from '@/lib/format';
import type { Watch, WatchedContract } from '@/lib/harness';
import { explorerUrl } from '@/lib/links';

function ContractStatus({ ttl }: Pick<WatchedContract, 'ttl'>) {
  if (!ttl) return <span className="text-muted-foreground">unavailable</span>;
  if (ttl.instance.archived) return <BracketTag label="archived" tone="default" emphasis />;
  return <span>{formatDecimal(ttl.instance.daysLeft, 1)} days left</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <StatLabel>{title}</StatLabel>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({
  label,
  address,
  value,
}: {
  label: string;
  address: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {address}
      </div>
      <span className="shrink-0 font-mono text-xs">{value}</span>
    </li>
  );
}

export interface WatchPanelProps {
  watch: Watch;
  org: Pick<Org, 'name' | 'network'>;
}

const TRIGGER_CLASS =
  'py-2 text-xs font-normal tracking-wide text-muted-foreground [font-variant-caps:all-small-caps] hover:no-underline';

export function WatchPanel({ watch, org }: WatchPanelProps) {
  return (
    <Sidebar className="md:absolute md:h-full">
      <SidebarHeader className="gap-2 border-b px-4 py-3 text-foreground">
        <p className="text-xs text-muted-foreground md:hidden">
          {org.name} on {org.network}
        </p>
        <NewChatButton />
      </SidebarHeader>
      <SidebarContent className="gap-4 p-4 text-foreground">
        <React.Suspense>
          <SidebarChats />
        </React.Suspense>
        <Accordion type="multiple" defaultValue={['watching', 'actions']}>
          <AccordionItem value="watching">
            <AccordionTrigger className={TRIGGER_CLASS}>what the harness watches</AccordionTrigger>
            <AccordionContent className="space-y-5">
              <Section title="accounts">
                {watch.accounts.map((account) => (
                  <Row
                    key={account.address}
                    label={account.label}
                    address={
                      <Address
                        value={account.address}
                        href={explorerUrl('account', account.address, org.network)}
                      />
                    }
                    value={
                      account.xlm === null
                        ? 'unavailable'
                        : `${formatDecimal(Number(account.xlm), 2)} XLM`
                    }
                  />
                ))}
              </Section>
              <Section title="contracts">
                {watch.contracts.map((contract) => (
                  <Row
                    key={contract.id}
                    label={contract.label}
                    address={
                      <Address
                        value={contract.id}
                        href={explorerUrl('contract', contract.id, org.network)}
                      />
                    }
                    value={<ContractStatus ttl={contract.ttl} />}
                  />
                ))}
              </Section>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="actions">
            <AccordionTrigger className={TRIGGER_CLASS}>
              {`proposed actions (${watch.actions.length})`}
            </AccordionTrigger>
            <AccordionContent>
              {watch.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                watch.actions.map((action) => (
                  <ActionCard key={action.id} action={action} compact />
                ))
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarContent>
    </Sidebar>
  );
}
