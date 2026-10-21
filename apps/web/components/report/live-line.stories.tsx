import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { delayedSummary, summaryFixture, waitingSummary, withLiveQuery } from './fixtures';
import { LiveLine } from './live-line';

const meta: Meta<typeof LiveLine> = {
  component: LiveLine,
  title: 'report/LiveLine',
  decorators: [withLiveQuery],
  args: { initial: summaryFixture },
};
export default meta;

type Story = StoryObj<typeof LiveLine>;

export const Live: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/live,/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: '64,800,123' })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/ledger/64800123',
    );
  },
};

export const Delayed: Story = {
  args: { initial: delayedSummary },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/delayed, last/)).toBeVisible();
  },
};

export const Waiting: Story = { args: { initial: waitingSummary } };
