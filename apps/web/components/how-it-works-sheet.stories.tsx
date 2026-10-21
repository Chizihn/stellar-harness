import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { HowItWorksSheet } from './how-it-works-sheet';

const meta: Meta<typeof HowItWorksSheet> = {
  component: HowItWorksSheet,
  title: 'components/HowItWorksSheet',
  args: { network: 'testnet' },
};
export default meta;

type Story = StoryObj<typeof HowItWorksSheet>;

export const Opens: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'How it works' }));
    const sheet = within(document.body);
    await expect(await sheet.findByText('Run it within your rules')).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'See the mainnet report' })).toHaveAttribute(
      'href',
      '/report',
    );
  },
};
