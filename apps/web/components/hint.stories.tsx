import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BracketTag } from './bracket-tag';
import { Hint, HintTerm } from './hint';

const HANDOFF_HINT =
  'Simulated with Soroban RPC simulateTransaction: nothing is signed or submitted.';

const meta: Meta<typeof Hint> = {
  component: Hint,
  title: 'components/Hint',
  args: {
    hint: HANDOFF_HINT,
    children: <BracketTag label="handoff" tone="warning" tabIndex={0} />,
  },
};
export default meta;

type Story = StoryObj<typeof Hint>;

export const Default: Story = {};

export const OpensOnFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByText('[handoff]')).toHaveFocus();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(HANDOFF_HINT);
  },
};

export const Term: Story = {
  render: () => (
    <p className="text-sm">
      <HintTerm hint="Wallets the company sends and receives money from.">Accounts</HintTerm>
    </p>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByText('Accounts')).toHaveFocus();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'Wallets the company',
    );
  },
};
