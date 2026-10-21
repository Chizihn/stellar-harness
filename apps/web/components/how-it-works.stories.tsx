import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { HOW_IT_WORKS_STEPS, HowItWorksSteps } from './how-it-works';

const meta: Meta<typeof HowItWorksSteps> = {
  component: HowItWorksSteps,
  title: 'components/HowItWorksSteps',
};
export default meta;

type Story = StoryObj<typeof HowItWorksSteps>;

export const Row: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(
      HOW_IT_WORKS_STEPS.length,
    );
    await expect(within(canvasElement).getByText('[coming soon]')).toBeVisible();
  },
};

export const Column: Story = { args: { layout: 'column' } };
