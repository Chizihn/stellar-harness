import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fakeAccount, fakeContract, fakeHash } from './story-ids';
import { AccountResult, ContractTtlResult, PreflightResult } from './tool-results';

const meta: Meta = {
  title: 'components/ToolResults',
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj;

export const Account: Story = {
  render: () => (
    <AccountResult
      account={{
        address: fakeAccount('treasury'),
        exists: true,
        xlm: '9893.9109013',
        sequence: '21434064355459079',
        signers: 1,
        trustlines: [
          {
            asset: `USDC:${fakeAccount('circle')}`,
            balance: '100.0000000',
            limit: '922337203685.4775807',
          },
        ],
      }}
    />
  ),
};

export const MissingAccount: Story = {
  render: () => (
    <AccountResult
      account={{
        address: fakeAccount('nobody'),
        exists: false,
        xlm: null,
        sequence: null,
        signers: 0,
        trustlines: [],
      }}
    />
  ),
};

export const ContractTtl: Story = {
  render: () => (
    <ContractTtlResult
      ttl={{
        contractId: fakeContract('escrow'),
        latestLedger: 4_990_627,
        wasmHash: fakeHash(1),
        instance: { liveUntilLedger: 5_111_510, daysLeft: 6.9, archived: false },
        code: { liveUntilLedger: null, daysLeft: 0, archived: true },
      }}
    />
  ),
};

export const PreflightBlocked: Story = {
  render: () => (
    <PreflightResult
      preflight={{
        ok: false,
        blockers: [
          {
            code: 'op_no_trust',
            plain: 'the receiving account has no trustline for this asset',
            fix: 'the receiver adds a trustline, or the sender sponsors one for it',
          },
        ],
      }}
    />
  ),
};

export const PreflightOk: Story = {
  render: () => <PreflightResult preflight={{ ok: true, blockers: [] }} />,
};
