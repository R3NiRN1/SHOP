# SHOP Runbook

## Quick start (PowerShell)
```powershell
corepack enable
pnpm run preflight
pnpm install
pnpm dev
```

App: http://localhost:3001

## Verification
```powershell
pnpm run lint
pnpm run build
```

## Env
Copy `apps/web/.env.example` → `apps/web/.env` and fill values. Do not commit secrets.
