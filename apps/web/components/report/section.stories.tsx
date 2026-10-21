import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { HarnessTag, Reason, Section, Waiting } from './section';
import { WAITING_LEDGERS } from './terms';

const meta: Meta<typeof Section> = {
  component: Section,
  title: 'report/Section',
  args: { id: 'example', title: 'Live feed', children: <Waiting>{WAITING_LEDGERS}</Waiting> },
};
export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Live feed' })).toBeVisible();
  },
};

export const Cells: Story = {
  args: {
    title: 'Reason and harness cells',
    children: (
      <div className="grid gap-4 sm:grid-cols-3">
        <Reason
          code="op_underfunded"
          plain="The sending account didn't have enough funds."
          phonePlain="The sending account didn't have enough funds."
        />
        <HarnessTag
          bucket="preventable"
          fix="Top up the sending account from treasury before paying."
        />
        <HarnessTag bucket="out_of_scope" />
      </div>
    ),
  },
};
