# Decisions

Every call made without explicit direction is tagged `@decision` so it can be reviewed in one pass. This file describes the code as it is now.

## Workspace

- `@decision` Internal packages export TypeScript source (`exports: ./src/index.ts`) and are not compiled to `dist`. `tsx`, `vitest` and Next.js (`transpilePackages`) all consume source directly, so `build` in a package is a type check.
- `@decision` Biome formats with single quotes, trailing commas and a 100 column width to match house style.
- `@decision` Commits are conventional and atomic, scoped by milestone and part (for example `feat(M16.e): ...`).
- `@decision` `knip` and `depcheck` run over every workspace. `knip` skips the vendored `components/ui` and `components/ai-elements`, `lib/api-handler.ts` and `lib/mixin.ts`, whose registries and options are part of the shared pattern, and `.git/**` for the local hooks. `apps/web/.depcheckrc` lists the CSS, build-tool and Storybook addon dependencies depcheck cannot see.

## Layout

- `@decision` `packages/chain` holds the one implementation of the decoder, the classifier, the RPC client, ledger tallies and contract checks. The worker, the scan CLI and the API all use it. Its README holds the method.
- `@decision` `apps/worker` is a small Hono app that writes the live tables; `apps/scan-cli` reuses the worker's run functions (`worker/run`), so a manual scan and the worker can never count differently. `scan txs --from --to` writes the cursor `scan`, never `txs`, so a manual range cannot move the worker's cursor.
- `@decision` The old scanner, its censuses, the anchor probe, the rent sample, the CSV exports and the publish script were deleted. The report is now live, not a published snapshot.

## Live data

- `@decision` The worker host is Railway (one replica, health check `/health`), the database is Postgres (local Docker on port 55432 for development, the production URL later), and the RPC is `https://mainnet.sorobanrpc.com`, overridable with `RPC_URL`. Its retention is about 121,000 ledgers (about 7 days).
- `@decision` Mainnet is read-only. Nothing is signed or sent; fix costs come from `simulateTransaction` with `SIMULATION_SOURCE`, a public account that holds no key here.
- `@decision` The report covers a rolling 24 hours. On first start, or when the cursor falls out of retention, the worker backfills the last 24 hours (ledger close time measured live) and then polls every `POLL_SECONDS`. The backfill reads 20-ledger windows 8 at a time and writes them in ledger order; serial reads managed about 0.5 ledgers per second, parallel windows about 1.6, and the RPC is the limit beyond that. Rereading a ledger is idempotent (delete and insert). Ledgers older than 48 hours are pruned hourly.
- `@decision` The active contract set (100+ lifetime invocations on stellar.expert, or SCF-funded on stellarlight) is rebuilt at most daily into `active_contracts`, because stellar.expert cannot sort by invocations and the full listing is slow. Expiry checks and fix costs run hourly against that set. A run that checks zero contracts keeps the stored data; a failed price fetch stores USD as null.
- `@decision` A fix cost is the price of extending to the longest TTL the network allows, read from the ledger (`stateArchival.maxEntryTtl` minus 1, now 3,110,399 ledgers, about 180 days), never a fixed 12 months. The report shows the day count it priced.
- `@decision` The daily snapshot is the UTC date of (now - 5 min - 1 day), written once at 00:05 UTC and only after a full catch-up, so a half-done backfill never becomes a snapshot.
- `@decision` `/health` always returns 200 with `cursorLedger`, `latestLedger`, `lagLedgers` and `lastWriteAt`.

## Public API and report

- `@decision` Six read-only routes under `/api/v1` (`summary`, `codes`, `failures/recent`, `accounts/top`, `contracts?status=`, `snapshots/[date]`) run through `apiHandler` with open CORS, `public, max-age=15` and 120 requests per minute per IP (in memory per instance). Every payload carries `generatedAt`, `startLedger` and `endLedger`, plus a `plain` explanation for each code.
- `@decision` `/report` is server rendered from the database (`force-dynamic`) so it works without JavaScript; the client polls `/summary` and `/failures/recent` every 5 seconds with `cache: 'no-store'`, because the browser would otherwise serve the 15 second cached response. The live line reads `delayed` when the newest ledger is more than 120 seconds old.
- `@decision` Codes the harness does not act on fold into one `other` row. Share is the count over all failed transactions.
- `@decision` The live feed uses `ui/table` so new rows can fade in; the other tables use `DataTable`.

## Product: one organisation, one screen

- `@decision` The home page explains the product before the chat: the value line, the four how it works steps, the demo scope line, and a live mainnet line from the database linking to `/report`. The same steps open in a sheet from the header, so there is no separate about page.
- `@decision` The header shows Report, How it works, a disabled Connect wallet button with a coming soon tooltip (organisation wallets through Stellar Wallets Kit are the funded roadmap), GitHub and the theme toggle.
- `@decision` The demo organisation is testnet only: two friendbot-funded accounts (treasury holds 100 testnet USDC, distribution has no trustline), and the `increment` example deployed twice as Escrow and Registry. Escrow was left to archive; Registry was extended to the network maximum on 2026-10-03. Testnet secret keys stay in the local Stellar CLI keystore and never enter the repo.
- `@decision` `withinPolicy` is true only when the operation is allowed and a cost is known and at or below `approvalAboveXlm`; an unknown cost needs approval. `dailySpendXlm` is shown but not enforced, since nothing executes.
- `@decision` Agent tools take organisation labels or roles ("Escrow", "treasury") as well as ids and reject subjects outside the organisation, because `gpt-4.1` mangled 56-character ids when copying them between calls.
- `@decision` `getMainnetReport` returns the summary and the top 10 codes, so network questions take one tool call. The chat stops after 5 steps, and tool calls render collapsed as one grey line under the answer.
- `@decision` The sidebar is seeded before anyone types: `lib/seed-actions.ts` runs the agent's own reads and records actions through `proposeAction`, at most once per 10 minutes per process. Proposed actions live in memory for the life of the server process.
- `@decision` Chat history is kept in the browser's local storage (`harness:conversations:v2`, newest 50), never in Postgres.
- `@decision` Migrations are SQL strings in `packages/storage/src/migrations.ts`, tracked in `app_migrations`, applied by the worker on start and by the web app on first use. Raw SQL through the `postgres` driver, no ORM.
- `@decision` The design keeps the existing tokens (Outfit, Instrument Serif, the green primary) with light and dark themes and the toggle. The engineering kit stays: the shadcn primitives, the RHF and Zod form fields, the responsive sheet, `DataTable`, the AI Elements the chat uses, Storybook with a story for every component, `apiHandler`, the validated env loader, the logger, `fetchJson`, `Result` and `memo`.
- `@decision` `gpt-4.1` is the default model; `OPENAI_MODEL` overrides it.
