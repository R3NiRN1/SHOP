# SHOP

## Quick start (Node 20.x, pnpm)

```powershell
cd <path-to-clone>\SHOP
corepack enable
pnpm -v # should match packageManager in package.json (10.0.0)
pnpm run preflight
pnpm install
pnpm -C apps/web exec prisma generate
pnpm dev
```
1. Install Node 20.x (use `.nvmrc` if you have nvm installed).
2. Install pnpm (the repo pins pnpm via `packageManager`).
3. Run the setup commands:

   ```bash
   cd <path-to-clone>/SHOP
   pnpm run preflight
   pnpm install
   pnpm -C apps/web exec prisma generate
   pnpm dev
   ```

The app runs at:

- http://localhost:3001


## Usable MVP

The storefront now works before production services are connected:

- `/` presents the seed shop landing page with featured varieties and enquiry calls to action.
- `/varieties` shows the live catalogue when `DATABASE_URL` is configured, otherwise it falls back to starter catalogue data so the app remains browsable.
- `/admin` and `/admin/varieties` are reserved for authenticated catalogue management once auth and database environment variables are configured.
- `/api/varieties` returns `{ varieties, source }`; `source` is `database` for live data or `starter` for fallback data.

Manual ordering is handled by email at `hello@example.org` until checkout is added.

## Node + pnpm versions

- Node is pinned in `.nvmrc` and both `package.json` files via `engines` (20.19.0). If you use nvm4w on Windows, run `nvm install 20.19.0` and `nvm use 20.19.0`.
- pnpm is pinned via `packageManager` and `engines` (10.0.0). Verify with `pnpm -v`.
## Environment configuration

- For local development, create `apps/web/.env.local` with real secrets (for example `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a real `DATABASE_URL`).
- CI uses placeholder values for build-only steps so lint/build can run without production secrets. Runtime auth remains disabled until a real `AUTH_SECRET`/`NEXTAUTH_SECRET` is provided.

## Validation commands

```bash
pnpm -w -r exec node -p "require('./package.json').name"
pnpm lint
pnpm build
```

## Copilot coding agent MCP

For the GitHub web Copilot coding agent MCP setup, follow [`docs/copilot-coding-agent-mcp.md`](docs/copilot-coding-agent-mcp.md).
