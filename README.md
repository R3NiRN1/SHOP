# SHOP

## Quick start (Node 20.x, pnpm)

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

## Environment configuration

- For local development, create `apps/web/.env.local` with real secrets (for example `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a real `DATABASE_URL`).
- CI uses placeholder values for build-only steps so lint/build can run without production secrets.

## Validation commands

```bash
pnpm -w -r exec node -p "require('./package.json').name"
pnpm -C apps/web lint
pnpm -C apps/web build
```
