# SHOP

## Requirements

- Node.js 20.x
- pnpm 10.x

## Quick start (PowerShell)

```powershell
cd <path-to-clone>\SHOP
pnpm run preflight
pnpm install
pnpm dev
```

The app runs at:

- http://localhost:3001

## Environment

- Copy `apps/web/.env.example` to `apps/web/.env` for local development as needed.
- CI uses build-only placeholder values (no real secrets).
- Production secrets should be supplied via GitHub Actions Secrets.

## Validation commands

```powershell
pnpm -w -r exec node -p "require('./package.json').name"
pnpm -C apps/web lint
pnpm -C apps/web build
```
