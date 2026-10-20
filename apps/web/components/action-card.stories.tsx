import type { Action } from '@harness/schema';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ActionCard, COMING_SOON, POLICY_HINTS } from './action-card';
import { fakeContract } from './story-ids';

const ACTION: Action = {
  id: 'a1',
  subject: fakeContract('escrow'),
  title: 'Keep Escrow alive for 180 days',
  why: 'Escrow has 6.9 days left before it is archived.',
  operation: 'extend_ttl',
  estimatedCostXlm: 27.31,
  withinPolicy: false,
  status: 'proposed',
};

const meta: Meta<typeof ActionCard> = {
  component: ActionCard,
  title: 'components/ActionCard',
  args: { action: ACTION },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ActionCard>;

export const NeedsApproval: Story = {};

export const WithinPolicy: Story = {
  args: {
    action: {
      ...ACTION,
      title: 'Let Distribution receive USDC',
      why: 'Distribution cannot receive USDC until it trusts the asset.',
      operation: 'sponsor_trustline',
      estimatedCostXlm: 0.5,
      withinPolicy: true,
    },
  },
};

export const UnknownCost: Story = { args: { action: { ...ACTION, estimatedCostXlm: undefined } } };

export const Compact: Story = { args: { compact: true } };

export const ButtonsAreDisabled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Execute' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await userEvent.hover(
      canvas.getByRole('button', { name: 'Execute' }).parentElement as HTMLElement,
    );
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(COMING_SOON);
  },
};

export const ExplainsTheTag: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByText('[needs approval]'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      POLICY_HINTS.approval,
    );
  },
};
