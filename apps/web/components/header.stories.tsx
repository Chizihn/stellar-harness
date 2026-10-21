import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ConversationsProvider } from './conversations-provider';
import { Header, WALLET_SOON } from './header';
import { SidebarProvider } from './ui/sidebar';

const meta: Meta<typeof Header> = {
  component: Header,
  title: 'components/Header',
  args: { network: 'testnet' },
  decorators: [
    (Story) => (
      <ConversationsProvider>
        <SidebarProvider className="min-h-0 flex-col">
          <Story />
        </SidebarProvider>
      </ConversationsProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Header>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Report' })).toHaveAttribute('href', '/report');
    await userEvent.click(canvas.getByRole('button', { name: 'How it works' }));
    await expect(await within(document.body).findByText('Prepare the fix')).toBeVisible();
    await expect(canvas.queryByText('Policy')).not.toBeInTheDocument();
  },
};

export const WalletComingSoon: Story = {
  play: async ({ canvasElement }) => {
    const wallet = within(canvasElement).getByRole('button', { name: 'Connect wallet' });
    await expect(wallet).toBeDisabled();
    await userEvent.hover(wallet.parentElement as HTMLElement);
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(WALLET_SOON);
  },
};
