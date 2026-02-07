# SHOP

## Windows 11 quick start (PowerShell)

```powershell
cd <path-to-clone>\SHOP
corepack enable
pnpm run preflight
pnpm install
pnpm dev
```

The app runs at:

- http://localhost:3001

## Notes

- Build/lint use placeholder env values in CI only. Provide real secrets for runtime auth.
- Copy `apps/web/.env.example` to `apps/web/.env` and fill in values for local auth.
- Prisma 7 requires a driver adapter or `PRISMA_ACCELERATE_URL`; provide one for local runtime DB access.

## Validation commands

```powershell
pnpm -w -r exec node -p "require('./package.json').name"
pnpm -C apps/web lint
pnpm -C apps/web build
```
