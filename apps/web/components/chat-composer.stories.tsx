import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatComposer, COMPOSER_PLACEHOLDER } from './chat-composer';

const meta: Meta<typeof ChatComposer> = {
  component: ChatComposer,
  title: 'components/ChatComposer',
  args: { onSubmit: fn(), onStop: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ChatComposer>;

export const Ready: Story = {};

export const Streaming: Story = { args: { status: 'streaming' } };

export const Sends: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText(COMPOSER_PLACEHOLDER),
      'How is Escrow?{enter}',
    );
    await expect(args.onSubmit).toHaveBeenCalledWith('How is Escrow?');
  },
};

export const HasAGuide: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'How to use the chat' }),
    ).toBeVisible();
  },
};
