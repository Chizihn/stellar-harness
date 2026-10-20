import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { Button } from './ui/button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'components/Button',
  args: { children: 'Connect wallet' },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: 'outline' } };

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: /Connect wallet/ });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(within(button).getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  },
};
