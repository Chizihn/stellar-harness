import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatList } from './chat-list';
import { Sidebar, SidebarContent, SidebarProvider } from './ui/sidebar';

const ITEMS = [
  { id: 'a', title: 'Check all our contracts and tell me which need attention' },
  { id: 'b', title: 'Can we pay 25 USDC from treasury to distribution right now?' },
  { id: 'c', title: 'What broke on mainnet today?' },
];

const meta: Meta<typeof ChatList> = {
  component: ChatList,
  title: 'components/ChatList',
  args: { items: ITEMS, activeId: 'b', onDelete: fn() },
  decorators: [
    (Story) => (
      <SidebarProvider className="min-h-0">
        <Sidebar collapsible="none" className="h-96 rounded-md border p-3">
          <SidebarContent>
            <Story />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ChatList>;

export const Default: Story = {};

export const Empty: Story = { args: { items: [] } };

export const Loading: Story = { args: { loading: true } };

export const Deletes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: ITEMS[2]?.title })).toHaveAttribute(
      'href',
      '/?c=c',
    );
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${ITEMS[0]?.title}` }));
    await expect(args.onDelete).toHaveBeenCalledWith('a');
  },
};
