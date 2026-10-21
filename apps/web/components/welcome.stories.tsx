import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { MainnetProof } from './mainnet-proof';
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
    await expect(canvas.getByText(/sample company on testnet/)).toBeVisible();
  },
};

export const WithProof: Story = {
  args: { proof: <MainnetProof preventable={41_382} failed={96_210} /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/could have been prevented/)).toBeVisible();
  },
};
