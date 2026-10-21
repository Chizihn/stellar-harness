# Progress

Resume here: read this file and `DECISIONS.md` first.

## Status

| Milestone               | State                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| M10 to M13 demo         | Done. One testnet organisation, eight agent tools, watched panel, chat with four chips and action cards, seeded fixes. |
| M16 live report and API | Done locally. Chain package, worker, six `/api/v1` routes, live `/report`, home page with how it works and live proof. |
| Production              | Not yet. Worker on Railway, `DATABASE_URL` and `OPENAI_API_KEY` on Vercel, migrations on the production database.      |

`pnpm build`, `pnpm lint`, `pnpm test`, `pnpm format:check`, the Storybook tests, `pnpm knip` and `pnpm depcheck` pass.

## Live report

Local worker against Docker Postgres, caught up on 2026-10-21 at 02:51 UTC after the 24 hour backfill (17,280 ledgers, 65,035,783 to 65,053,062).

| Last 24 hours                                      | Value                                            |
| -------------------------------------------------- | ------------------------------------------------ |
| Transactions, failed                               | 4,565,565, 997,547                               |
| Failures a check would have prevented              | 70,961                                           |
| Failures that could be retried and completed       | 838,427                                          |
| Active contracts archived, expiring within 30 days | 253, 155                                         |
| Cost to keep them alive for 180 days               | 18,013.65 XLM (about $3,286 at 0.182422 XLM/USD) |

- Top codes: `op_over_source_max` 546,470, `op_under_dest_min` 291,770, `op_underfunded` 40,234, `invoke_host_function_trapped` 33,233, `op_too_few_offers` 32,134, `op_no_trust` 20,304.
- `/health` lag 0 ledgers once caught up. The backfill ran at about 1.6 to 2.7 ledgers per second; nine transaction reads hit RPC 429s while the first contracts run shared the RPC, and each was retried from the cursor.
- The first daily snapshot is written at 00:05 UTC after a full day of running.

## Chip timings (M16)

Production build on this machine, `gpt-4.1`, 2026-10-21, three runs each. Time to the end of the reply.

| Chip                          | Time      | Tool calls                                                      |
| ----------------------------- | --------- | --------------------------------------------------------------- |
| What needs fixing right now?  | 7 to 16 s | 6: two accounts and two contracts in one step, restore, propose |
| Why would a USDC payout fail? | 4 to 5 s  | 2: preflight, propose                                           |
| When does Escrow expire?      | 6 to 11 s | 3: contract, restore, propose                                   |
| What broke on mainnet today?  | 3 to 5 s  | 1: `getMainnetReport`                                           |

The slow runs are the public testnet RPC stalling for 10 s or more on one request; reads now race a fresh request after 3 s.

## Layout

```
packages/chain          decoder, classifier, RPC client, ledger tallies, contract checks (method in its README)
packages/storage        Storage for the demo, Postgres client, migrations, live tables
packages/stellar-tools  the testnet reads and simulations the agent uses
packages/agent          the eight AI SDK tools, the system prompt and the org brief
packages/schema         Org, Action, Result, AppError, defineEnv
apps/worker             Hono worker: transactions loop, hourly contracts, daily snapshot, /health
apps/web                home page with chat, /report, /api/chat, /api/v1/*
```

## Next step

Deploy: the worker on Railway with `DATABASE_URL`, `RPC_URL` and `SIMULATION_SOURCE`, then the web app on Vercel with `DATABASE_URL` and `OPENAI_API_KEY` pointing at the same database. After that, make execution real: a smart account whose policy matches `Org.policy`, connected through Stellar Wallets Kit, turning the disabled Connect wallet, execute and approve buttons into signed submissions.
