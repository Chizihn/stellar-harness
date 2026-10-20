import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatSuggestions, SUGGESTIONS } from './chat-suggestions';

const meta: Meta<typeof ChatSuggestions> = {
  component: ChatSuggestions,
  title: 'components/ChatSuggestions',
  args: { onSelect: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ChatSuggestions>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const SendsThePrompt: Story = {
  play: async ({ canvasElement, args }) => {
    const [, payout] = SUGGESTIONS;
    await userEvent.click(within(canvasElement).getByRole('button', { name: payout?.label }));
    await expect(args.onSelect).toHaveBeenCalledWith(payout?.prompt);
  },
};
