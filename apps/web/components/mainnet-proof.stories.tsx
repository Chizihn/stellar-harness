import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { MainnetProof } from './mainnet-proof';

const meta: Meta<typeof MainnetProof> = {
  component: MainnetProof,
  title: 'components/MainnetProof',
  args: { preventable: 41_382, failed: 96_210 },
};
export default meta;

type Story = StoryObj<typeof MainnetProof>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/could have been prevented/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'See the live report' })).toHaveAttribute(
      'href',
      '/report',
    );
  },
};

export const Waiting: Story = {
  args: { preventable: 0, failed: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/could have been prevented/)).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'See what is failing on Stellar mainnet right now' }),
    ).toBeVisible();
  },
};
