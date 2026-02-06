# SHOP

## Windows 11 quick start (PowerShell)

```powershell
cd <path-to-clone>\SHOP
pnpm -v
pnpm run preflight
$env:DATABASE_URL="file:./dev.db"
$env:NEXTAUTH_SECRET="dev-only-change-me"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="admin"
pnpm run setup
pnpm dev
```

The app runs at:

- http://localhost:3001

## Node + pnpm versions

- Node is pinned in `.nvmrc` (20.19.0). If you use nvm4w on Windows, run `nvm install 20.19.0` and `nvm use 20.19.0`.
- pnpm is pinned via `packageManager` in the root `package.json`. Verify with `pnpm -v`.

## Validation commands

```powershell
pnpm -w -r exec node -p "require('./package.json').name"
pnpm -C apps/web lint
pnpm -C apps/web build
```
