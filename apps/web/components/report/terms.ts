export const TERMS = {
  ledger: 'One page of the shared Stellar record. A new one closes every few seconds.',
  preventable: 'A check before sending would have found the cause, so it could be fixed first.',
  retryable:
    'The cause was temporary, so sending again with a fresh price, fee or time window works.',
  active: 'Contracts with 100+ lifetime calls, or funded by the Stellar Community Fund.',
  archived: "The contract's data expired. It stops working until someone restores it.",
  expiring: 'The contract will be archived within 30 days unless someone renews it.',
  fixCost:
    'The network fee to restore and renew these contracts, measured by simulating the fix on mainnet.',
  contractFixCost: 'The network fee to restore and renew this contract, from a simulation.',
  daysLeft: 'Days until this contract is archived and stops working.',
  noCost: 'The simulation failed, so no cost is shown.',
  scf: 'The Stellar Community Fund, which funds projects building on Stellar.',
} as const;

export const WAITING_LEDGERS = 'Waiting for the first ledgers from the worker.';

export const WAITING_CONTRACTS = 'Waiting for the first contract check from the worker.';
