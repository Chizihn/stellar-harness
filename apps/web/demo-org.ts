import type { Org } from '@harness/schema';

export const DEMO_ORG: Org = {
  id: 'demo-treasury',
  name: 'Demo Treasury Ltd',
  network: 'testnet',
  accounts: [
    {
      address: 'GDG4ULPBFQ4XF27ZUMQFJ7LSRPNMZLLCQDJWRV7PZZPEEQ7IGCHPQMK6',
      label: 'Treasury',
      role: 'treasury',
    },
    {
      address: 'GD7DV4D2W65SZ6IAXDLT24QL7O7BCOG2R5MACOOOQZ4P2GRXOXUKZOIK',
      label: 'Distribution',
      role: 'distribution',
    },
  ],
  contracts: [
    { id: 'CADKCKAZEOUXFS46JTA73DFGCWUGTZDKU5UTUAEA6OAZB7RV5CEHS47R', label: 'Escrow' },
    { id: 'CBRSCFRPCMKZCUTJMOVU5XQWZVXXSM66MGB4CEFRT5KWDI4XLM44DK5M', label: 'Registry' },
  ],
  policy: {
    dailySpendXlm: 50,
    allowedOperations: ['extend_ttl', 'restore', 'sponsor_trustline', 'payment'],
    approvalAboveXlm: 10,
  },
};
