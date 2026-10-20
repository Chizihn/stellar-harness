import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CopyButton } from './copy-button';

const meta: Meta<typeof CopyButton> = {
  component: CopyButton,
  title: 'components/CopyButton',
  args: { value: 'GFAKEACCOUNTFORSTORYBOOKONLY000000000000000000000000000' },
};
export default meta;

type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {};

export const WithLabel: Story = { args: { label: 'Copy transaction hash' } };
