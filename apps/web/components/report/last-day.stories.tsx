import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { summaryFixture, waitingSummary, whatFailedFixture, withLiveQuery } from './fixtures';
import { LastDay } from './last-day';
import { WAITING_LEDGERS } from './terms';

const meta: Meta<typeof LastDay> = {
  component: LastDay,
  title: 'report/LastDay',
  decorators: [withLiveQuery],
  args: { initial: summaryFixture, rows: whatFailedFixture },
};
export default meta;

type Story = StoryObj<typeof LastDay>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('9,812')).toBeVisible();
    await expect(canvas.getByText('of 48,220 failed transactions')).toBeVisible();
    await expect(canvas.getByText(/to keep them alive for 180 days/)).toBeVisible();
    const rows = canvas.getAllByRole('row');
    await expect(rows.at(-1)).toHaveTextContent('other');
  },
};

export const NoPrice: Story = {
  args: {
    initial: {
      ...summaryFixture,
      contracts: summaryFixture.contracts && { ...summaryFixture.contracts, fixCostUsd: null },
    },
  },
};

export const NoContractCheck: Story = {
  args: { initial: { ...summaryFixture, contracts: null } },
};

export const NothingFailed: Story = { args: { rows: [] } };

export const Waiting: Story = {
  args: { initial: waitingSummary, rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(WAITING_LEDGERS)).toBeVisible();
  },
};
