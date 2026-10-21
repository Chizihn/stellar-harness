# worker

Reads Stellar mainnet into Postgres for `/report`: every ledger's failed transactions (backfills the last 24 hours on first start, then polls), active contract expiry and fix cost hourly, pruning hourly, and a daily snapshot at 00:05 UTC. Serves `GET /health`.

Env: `DATABASE_URL` (required), `RPC_URL` (default `https://mainnet.sorobanrpc.com`), `SIMULATION_SOURCE` (public account used only to simulate fixes), `POLL_SECONDS` (default 5), `PORT` (default 8787). Locally it also reads the repo root `.env`.

Run: `pnpm --filter worker start`.

Railway: root directory = repo root, build command `pnpm --filter worker build`, start command `pnpm --filter worker start`, health check path `/health`, one replica.
