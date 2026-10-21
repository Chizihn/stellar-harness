import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { VALUE_LINE, Welcome } from './welcome';

const meta: Meta<typeof Welcome> = {
  component: Welcome,
  title: 'components/Welcome',
  args: { network: 'testnet' },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Welcome>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: VALUE_LINE })).toBeVisible();
    await expect(canvas.getByText(/steps 1 to 3 on testnet/)).toBeVisible();
  },
};

export const WithProof: Story = {
  args: {
    proof: (
      <p className="text-sm">
        <a href="/report" className="underline underline-offset-4">
          See what is failing on mainnet right now
        </a>
      </p>
    ),
  },
};
