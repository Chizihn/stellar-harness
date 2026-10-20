'use client';

import { QuestionIcon } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

const GOOD_QUESTIONS = [
  'What needs fixing?',
  'Why did this payment fail?',
  'What does it cost to renew this contract?',
  'What broke on mainnet today?',
];

const LIMITS = [
  'It only knows the demo company and the mainnet report.',
  'It never signs or sends anything in this demo.',
];

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ChatGuide() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="How to use the chat">
          <QuestionIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 space-y-3 text-sm">
        <PopoverHeader>
          <PopoverTitle>How to use the chat</PopoverTitle>
        </PopoverHeader>
        <div className="space-y-1">
          <p>Ask in plain words. Good questions:</p>
          <Bullets items={GOOD_QUESTIONS} />
        </div>
        <div className="space-y-1">
          <p>What it can&apos;t do here:</p>
          <Bullets items={LIMITS} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
