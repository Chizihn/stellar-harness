import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { topAccountsFixture } from './fixtures';
import { TopAccounts } from './top-accounts';

const meta: Meta<typeof TopAccounts> = {
  component: TopAccounts,
  title: 'report/TopAccounts',
  args: { rows: topAccountsFixture },
};
export default meta;

type Story = StoryObj<typeof TopAccounts>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('page 1 of 3, 25 rows')).toBeVisible();
    await expect(canvas.getAllByRole('row')).toHaveLength(11);
  },
};

export const Empty: Story = { args: { rows: [] } };
