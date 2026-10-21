import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { expect, within } from 'storybook/test';
import type { RecentPayload } from '@/lib/live-schemas';
import { recentFailure, recentFixture, withLiveQuery } from './fixtures';
import { LiveFeed } from './live-feed';
import { WAITING_LEDGERS } from './terms';

const meta: Meta<typeof LiveFeed> = {
  component: LiveFeed,
  title: 'report/LiveFeed',
  decorators: [withLiveQuery],
  args: { initial: recentFixture },
};
export default meta;

type Story = StoryObj<typeof LiveFeed>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('row')).toHaveLength(recentFixture.failures.length + 1);
    await expect(canvas.getAllByText(/^\d+s ago$/)[0]).toBeVisible();
  },
};

function WithArrival() {
  const client = useQueryClient();
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      client.setQueryData<RecentPayload>(['live', 'recent'], (current) =>
        current ? { ...current, failures: [recentFailure(99, 0), ...current.failures] } : current,
      );
    }, 300);
    return () => window.clearTimeout(id);
  }, [client]);
  return <LiveFeed initial={recentFixture} />;
}

export const NewRowFadesIn: Story = {
  render: () => <WithArrival />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findAllByRole('row', {}, { timeout: 2000 }).then((rows) => rows.length),
    ).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await expect(canvasElement.querySelectorAll('tr[data-new]')).toHaveLength(1);
  },
};

export const Waiting: Story = {
  args: { initial: { ...recentFixture, failures: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(WAITING_LEDGERS)).toBeVisible();
  },
};
