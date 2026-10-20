'use client';

import type { HarnessMessage } from '@harness/agent';
import { getToolName } from 'ai';
import { ActionCard } from '@/components/action-card';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import { ToolErrorRow } from '@/components/tool-error-row';
import { AccountResult, ContractTtlResult, PreflightResult } from '@/components/tool-results';
import { summarizeArgs } from '@/lib/format';

type Part = HarnessMessage['parts'][number];
export type ToolCallPart = Extract<Part, { type: `tool-${string}` }>;

export const isToolCallPart = (part: Part): part is ToolCallPart => part.type.startsWith('tool-');

const toolCallTitle = (part: ToolCallPart): string =>
  `${getToolName(part)}(${summarizeArgs(part.input)})`;

function ToolOutput({ part }: { part: ToolCallPart }) {
  if (part.state !== 'output-available') return null;
  switch (part.type) {
    case 'tool-getAccount':
      return <AccountResult account={part.output} />;
    case 'tool-getContractTtl':
      return <ContractTtlResult ttl={part.output} />;
    case 'tool-buildPaymentPreflight':
      return <PreflightResult preflight={part.output} />;
    default:
      return null;
  }
}

function ToolCallBody({ part }: { part: ToolCallPart }) {
  if (part.state === 'output-available') return <ToolOutput part={part} />;
  if (part.state === 'output-error') return <ToolErrorRow message={part.errorText} />;
  return (
    <Shimmer as="p" className="font-mono text-xs">
      {`calling ${getToolName(part)}…`}
    </Shimmer>
  );
}

export function ToolCall({ part }: { part: ToolCallPart }) {
  if (part.type === 'tool-proposeAction' && part.state === 'output-available') {
    return <ActionCard action={part.output} />;
  }
  return (
    <Tool defaultOpen className="mb-0 rounded-none border-none bg-transparent">
      <ToolHeader
        type={part.type}
        state={part.state}
        title={toolCallTitle(part)}
        className="gap-2 px-0 py-1 text-left font-mono text-muted-foreground [&>div]:min-w-0 [&>div>span:not([data-slot=badge])]:min-w-0 [&>div>span:not([data-slot=badge])]:truncate [&_[data-slot=badge]]:shrink-0 [&_[data-slot=badge]]:bg-transparent [&_[data-slot=badge]]:px-0 [&_span]:font-mono [&_span]:text-xs [&_svg]:shrink-0"
      />
      <ToolContent className="space-y-0 border-none p-0 pt-1">
        <ToolCallBody part={part} />
      </ToolContent>
    </Tool>
  );
}
