import type { Org } from '@harness/schema';
import * as React from 'react';
import { ActionCard } from '@/components/action-card';
import { Address } from '@/components/address';
import { BracketTag } from '@/components/bracket-tag';
import { NewChatButton, SidebarChats } from '@/components/chat-list';
import { HintTerm } from '@/components/hint';
import { StatLabel } from '@/components/stat';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { formatDecimal } from '@/lib/format';
import type { Watch, WatchedContract } from '@/lib/harness';
import { explorerUrl } from '@/lib/links';
import { spendingRules } from '@/lib/policy';

export const WATCH_HINTS = {
  accounts: 'Wallets the company sends and receives money from.',
  contracts: 'Programs the company runs on Stellar. They expire unless renewed.',
  daysLeft: 'Time until this contract is archived and stops working.',
} as const;

export const companyTitle = (org: Pick<Org, 'name' | 'network'>): string =>
  `Demo company: ${org.name} (${org.network})`;

function ContractStatus({ ttl }: Pick<WatchedContract, 'ttl'>) {
  if (!ttl) return <span className="text-muted-foreground">unavailable</span>;
  if (ttl.instance.archived) return <BracketTag label="archived" tone="default" emphasis />;
  return (
    <HintTerm hint={WATCH_HINTS.daysLeft}>
      {formatDecimal(ttl.instance.daysLeft, 1)} days left
    </HintTerm>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <StatLabel>
        <HintTerm hint={hint}>{title}</HintTerm>
      </StatLabel>
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
  org: Pick<Org, 'name' | 'network' | 'policy'>;
}

const TRIGGER_CLASS = 'py-2 text-left text-sm font-medium hover:no-underline';

export function WatchPanel({ watch, org }: WatchPanelProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3 text-foreground">
        <NewChatButton />
      </SidebarHeader>
      <SidebarContent className="gap-4 p-4 text-foreground">
        <React.Suspense>
          <SidebarChats />
        </React.Suspense>
        <Accordion type="multiple" defaultValue={['watching', 'fixes']}>
          <AccordionItem value="watching">
            <AccordionTrigger className={TRIGGER_CLASS}>{companyTitle(org)}</AccordionTrigger>
            <AccordionContent className="space-y-5">
              <Section title="Accounts" hint={WATCH_HINTS.accounts}>
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
              <Section title="Contracts" hint={WATCH_HINTS.contracts}>
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
          <AccordionItem value="fixes">
            <AccordionTrigger className={TRIGGER_CLASS}>
              {`Fixes the harness found (${watch.actions.length})`}
            </AccordionTrigger>
            <AccordionContent>
              {watch.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing needs fixing right now.</p>
              ) : (
                watch.actions.map((action) => (
                  <ActionCard key={action.id} action={action} compact />
                ))
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarContent>
      <SidebarFooter className="gap-1 border-t px-4 py-3 text-foreground">
        <StatLabel>Spending rules</StatLabel>
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {spendingRules(org.policy).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SidebarFooter>
    </Sidebar>
  );
}
