import type { HarnessMessage } from '@harness/agent';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { Chat } from './chat';
import { INTRO_TITLE } from './chat-intro';
import { fakeContract } from './story-ids';
import { VALUE_LINE, Welcome } from './welcome';

const ESCROW = fakeContract('escrow');

const CONVERSATION = [
  {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text: 'When does Escrow expire?' }],
  },
  {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'step-start' },
      {
        type: 'tool-getContractTtl',
        toolCallId: 't1',
        state: 'output-available',
        input: { contract: 'Escrow' },
        output: {
          contractId: ESCROW,
          latestLedger: 4_990_627,
          wasmHash: null,
          instance: { liveUntilLedger: 5_111_510, daysLeft: 6.9, archived: false },
          code: null,
        },
      },
      {
        type: 'tool-proposeAction',
        toolCallId: 't2',
        state: 'output-available',
        input: {},
        output: {
          id: 'a1',
          subject: ESCROW,
          title: 'Keep Escrow alive for 180 days',
          why: 'Escrow has 6.9 days left before it is archived.',
          operation: 'extend_ttl',
          estimatedCostXlm: 27.31,
          withinPolicy: false,
          status: 'proposed',
        },
      },
      { type: 'step-start' },
      {
        type: 'text',
        text: 'Escrow stops working in about 7 days. Keeping it alive costs 27.31 XLM, which needs approval.',
        state: 'done',
      },
    ],
  },
] as HarnessMessage[];

const meta: Meta<typeof Chat> = {
  component: Chat,
  title: 'components/Chat',
  args: { id: 'story' },
  decorators: [
    (Story) => (
      <div className="flex h-[640px] flex-col">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Chat>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: INTRO_TITLE })).toBeVisible();
  },
};

export const WithWelcome: Story = {
  args: { welcome: <Welcome network="testnet" /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: VALUE_LINE })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: INTRO_TITLE })).toBeVisible();
  },
};

export const AnswerFirst: Story = {
  args: { id: 'answer', initialMessages: CONVERSATION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const answer = await canvas.findByText(/Escrow stops working/);
    const steps = canvas.getByRole('button', { name: 'checked 1 contract, proposed 1 fix' });
    await expect(
      answer.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(canvas.getByText('Keep Escrow alive for 180 days')).toBeVisible();
  },
};
