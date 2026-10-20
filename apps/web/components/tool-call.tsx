'use client';

import type { HarnessMessage } from '@harness/agent';
import { CaretRightIcon } from '@phosphor-icons/react/ssr';
import { getToolName } from 'ai';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import { ToolErrorRow } from '@/components/tool-error-row';
import { AccountResult, ContractTtlResult, PreflightResult } from '@/components/tool-results';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { summarizeArgs } from '@/lib/format';
import { isToolRunning, summarizeToolParts } from '@/lib/tool-summary';

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

export function ToolSteps({ parts }: { parts: ToolCallPart[] }) {
  const summary = summarizeToolParts(parts) || 'working';
  return (
    <Collapsible className="not-prose">
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-left font-mono text-xs text-muted-foreground hover:text-foreground">
        <CaretRightIcon className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        {isToolRunning(parts) ? <Shimmer as="span">{`${summary}…`}</Shimmer> : summary}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-2 pl-4">
        {parts.map((part) => (
          <ToolCall key={part.toolCallId} part={part} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
