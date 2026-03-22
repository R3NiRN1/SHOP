# SHOP

## Windows 11 quick start (PowerShell)

```powershell
cd <path-to-clone>\SHOP
corepack enable
pnpm run preflight
pnpm setup
pnpm dev
```

The app runs at:

- http://localhost:3001

## Notes

- Build/lint use placeholder env values in CI only. Provide real secrets for runtime auth.
- Copy `apps/web/.env.example` to `apps/web/.env` and fill in values for local auth.
- Runtime auth stays disabled until `AUTH_SECRET` or `NEXTAUTH_SECRET` is set to a non-placeholder value.
- Prisma generate uses a CI-safe placeholder `DATABASE_URL` during install, but local/runtime DB access still requires a real connection string.
- Prisma 7 requires a driver adapter or `PRISMA_ACCELERATE_URL`; provide one for local runtime DB access.

## Validation commands

```powershell
pnpm run doctor
pnpm -w -r exec node -p "require('./package.json').name"
pnpm lint
pnpm build
```
