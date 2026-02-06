# SHOP

## Windows 11 quick start (PowerShell)

```powershell
cd <path-to-clone>\SHOP
corepack enable
pnpm -v # should match packageManager in package.json (10.0.0)
pnpm run preflight
pnpm install
pnpm -C apps/web exec prisma generate
pnpm dev
```

The app runs at:

- http://localhost:3001

## Validation commands

```powershell
pnpm -w -r exec node -p "require('./package.json').name"
pnpm -C apps/web lint
pnpm -C apps/web build
```
