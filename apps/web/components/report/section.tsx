import type { Bucket } from '@harness/chain';
import { cn } from 'cn';
import * as React from 'react';
import { HintTerm } from '@/components/hint';

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 space-y-4 border-t pt-8"
    >
      <h2 id={`${id}-title`} className="text-base font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function Reason({
  code,
  plain,
  phonePlain,
}: {
  code: string;
  plain: React.ReactNode;
  phonePlain?: string;
}) {
  return (
    <span className="block">
      <HintTerm hint={plain} className="font-mono whitespace-normal">
        {code.split('_').map((part, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed code
          <React.Fragment key={index}>
            {index > 0 && (
              <>
                _<wbr />
              </>
            )}
            {part}
          </React.Fragment>
        ))}
      </HintTerm>
      {phonePlain && (
        <span className="block min-w-36 font-sans text-xs whitespace-normal text-muted-foreground sm:hidden">
          {phonePlain}
        </span>
      )}
    </span>
  );
}

const TAG: Record<Bucket, string> = {
  preventable: 'prevent',
  retryable: 'retry',
  out_of_scope: '–',
};

export function HarnessTag({ bucket, fix }: { bucket: Bucket; fix?: string | null }) {
  return (
    <span className="block">
      <span className={cn('font-mono', bucket === 'out_of_scope' && 'text-muted-foreground')}>
        {TAG[bucket]}
      </span>
      {fix && (
        <span className="hidden min-w-40 font-sans text-xs whitespace-normal text-muted-foreground sm:block">
          {fix}
        </span>
      )}
    </span>
  );
}
