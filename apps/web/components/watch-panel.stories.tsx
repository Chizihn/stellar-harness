import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { DEMO_ORG } from '@/demo-org';
import type { Watch } from '@/lib/harness';
import { spendingRules } from '@/lib/policy';
import { ConversationsProvider } from './conversations-provider';
import { fakeAccount, fakeContract, fakeHash } from './story-ids';
import { SidebarProvider } from './ui/sidebar';
import { companyTitle, WATCH_HINTS, WatchPanel } from './watch-panel';

const ttl = (daysLeft: number, archived = false) => ({
  contractId: fakeContract('escrow'),
  latestLedger: 4_990_627,
  wasmHash: fakeHash(1),
  instance: { liveUntilLedger: archived ? null : 5_111_510, daysLeft, archived },
  code: { liveUntilLedger: 5_111_509, daysLeft, archived },
});

const WATCH: Watch = {
  accounts: [
    { address: fakeAccount('treasury'), label: 'Treasury', role: 'treasury', xlm: '9893.9109013' },
    {
      address: fakeAccount('distribution'),
      label: 'Distribution',
      role: 'distribution',
      xlm: '10000',
    },
  ],
  contracts: [
    { id: fakeContract('escrow'), label: 'Escrow', ttl: ttl(6.9) },
    { id: fakeContract('registry'), label: 'Registry', ttl: ttl(0, true) },
  ],
  actions: [
    {
      id: 'a1',
      subject: fakeContract('escrow'),
      title: 'Keep Escrow alive for 180 days',
      why: 'Escrow has 6.9 days left.',
      operation: 'extend_ttl',
      estimatedCostXlm: 27.31,
      withinPolicy: false,
      status: 'proposed',
    },
  ],
};

const meta: Meta<typeof WatchPanel> = {
  component: WatchPanel,
  title: 'components/WatchPanel',
  args: { watch: WATCH, org: DEMO_ORG },
  decorators: [
    (Story) => (
      <ConversationsProvider>
        <SidebarProvider className="relative h-[720px] min-h-0">
          <Story />
        </SidebarProvider>
      </ConversationsProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof WatchPanel>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: companyTitle(DEMO_ORG) })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Fixes the harness found/ })).toBeVisible();
    for (const rule of spendingRules(DEMO_ORG.policy)) {
      await expect(canvas.getByText(rule)).toBeVisible();
    }
  },
};

export const ExplainsTerms: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByText('Contracts'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      WATCH_HINTS.contracts,
    );
  },
};

export const NothingProposed: Story = { args: { watch: { ...WATCH, actions: [] } } };

export const ReadsUnavailable: Story = {
  args: {
    watch: {
      ...WATCH,
      accounts: WATCH.accounts.map((account) => ({ ...account, xlm: null })),
      contracts: WATCH.contracts.map((contract) => ({ ...contract, ttl: null })),
    },
  },
};
