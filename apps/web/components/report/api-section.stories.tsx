import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { ApiSection } from './api-section';

const meta: Meta<typeof ApiSection> = {
  component: ApiSection,
  title: 'report/ApiSection',
  args: { origin: 'https://stellarharness.xyz', yesterday: '2026-10-20' },
};
export default meta;

type Story = StoryObj<typeof ApiSection>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(6);
    await expect(
      canvas.getByText('curl https://stellarharness.xyz/api/v1/snapshots/2026-10-20'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Copy curl for /api/v1/summary' }),
    ).toBeVisible();
  },
};
