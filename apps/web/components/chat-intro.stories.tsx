import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatIntro, INTRO_TITLE } from './chat-intro';
import { SUGGESTIONS } from './chat-suggestions';

const meta: Meta<typeof ChatIntro> = {
  component: ChatIntro,
  title: 'components/ChatIntro',
  args: { onSelect: fn() },
};
export default meta;

type Story = StoryObj<typeof ChatIntro>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: INTRO_TITLE })).toBeVisible();
    for (const { label } of SUGGESTIONS) {
      await expect(canvas.getByRole('button', { name: label })).toBeVisible();
    }
  },
};

export const Busy: Story = { args: { disabled: true } };

export const AsksAboutMainnet: Story = {
  play: async ({ canvasElement, args }) => {
    const mainnet = SUGGESTIONS.at(-1);
    await userEvent.click(within(canvasElement).getByRole('button', { name: mainnet?.label }));
    await expect(args.onSelect).toHaveBeenCalledWith(mainnet?.prompt);
  },
};
