import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { fakeContract, fakeHash } from './story-ids';
import { type ToolCallPart, ToolSteps } from './tool-call';

const ttl = (label: string, daysLeft: number) => ({
  contractId: fakeContract(label),
  latestLedger: 4_990_627,
  wasmHash: fakeHash(1),
  instance: { liveUntilLedger: 5_111_510, daysLeft, archived: false },
  code: { liveUntilLedger: 5_111_509, daysLeft, archived: false },
});

const PARTS = [
  {
    type: 'tool-getContractTtl',
    toolCallId: 'c1',
    state: 'output-available',
    input: { contract: 'Escrow' },
    output: ttl('escrow', 6.9),
  },
  {
    type: 'tool-getContractTtl',
    toolCallId: 'c2',
    state: 'output-available',
    input: { contract: 'Registry' },
    output: ttl('registry', 120),
  },
  {
    type: 'tool-simulateExtendTtl',
    toolCallId: 's1',
    state: 'output-available',
    input: { contract: 'Escrow', days: 180 },
    output: {
      contractId: fakeContract('escrow'),
      operation: 'extend_ttl',
      minResourceFeeStroops: 273_032_180,
      estimatedCostXlm: 27.3,
      footprintEntries: 2,
      latestLedger: 4_990_627,
    },
  },
] as ToolCallPart[];

const meta: Meta<typeof ToolSteps> = {
  component: ToolSteps,
  title: 'components/ToolSteps',
  args: { parts: PARTS },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ToolSteps>;

export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'checked 2 contracts, simulated 1 fix' }),
    ).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Expands: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /checked 2 contracts/ }));
    await expect(await canvas.findByText(/simulateExtendTtl/)).toBeVisible();
  },
};

export const Running: Story = {
  args: {
    parts: [
      {
        type: 'tool-getMainnetReport',
        toolCallId: 'r1',
        state: 'input-available',
        input: {},
      } as ToolCallPart,
    ],
  },
};

export const Failed: Story = {
  args: {
    parts: [
      {
        type: 'tool-getMainnetReport',
        toolCallId: 'r1',
        state: 'output-error',
        input: {},
        errorText: 'The mainnet report is not connected yet.',
      } as ToolCallPart,
    ],
  },
};
