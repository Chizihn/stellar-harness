import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ContractsSection } from './contracts-section';
import { archivedFixture, expiringFixture, summaryFixture } from './fixtures';
import { WAITING_CONTRACTS } from './terms';

const meta: Meta<typeof ContractsSection> = {
  component: ContractsSection,
  title: 'report/ContractsSection',
  args: {
    archived: archivedFixture,
    expiring: expiringFixture,
    checkedAt: summaryFixture.contracts?.checkedAt ?? null,
  },
};
export default meta;

type Story = StoryObj<typeof ContractsSection>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Archived (12)')).toBeVisible();
    await expect(canvas.getByText('Expiring within 30 days (4)')).toBeVisible();
    await expect(canvas.getByText('page 1 of 2, 12 rows')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByText('page 2 of 2, 12 rows')).toBeVisible();
  },
};

export const NoneFound: Story = { args: { archived: [], expiring: [] } };

export const Waiting: Story = {
  args: { checkedAt: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(WAITING_CONTRACTS)).toBeVisible();
  },
};
