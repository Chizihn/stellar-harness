import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ChatGuide } from './chat-guide';

const meta: Meta<typeof ChatGuide> = {
  component: ChatGuide,
  title: 'components/ChatGuide',
  decorators: [
    (Story) => (
      <div className="pt-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ChatGuide>;

export const Default: Story = {};

export const Opens: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'How to use the chat' }),
    );
    const guide = await within(document.body).findByRole('dialog');
    await expect(guide).toHaveTextContent('How to use the chat');
    await expect(guide).toHaveTextContent('It never signs or sends anything in this demo.');
  },
};
