# SHOP

A small Next.js seed catalogue/storefront with a protected catalogue-admin surface. The current ordering path is enquiry-based; checkout and payment processing are not implemented.

## Runtime model

- Public catalogue reads expose only `Variety.published = true` records.
- Catalogue writes live under `/api/admin/*` and require an authenticated `ADMIN` session plus same-origin mutation checks.
- Production database failure fails closed: sample inventory is never substituted.
- Starter entries are available only when `ENABLE_STARTER_CATALOG=true` outside production, and are explicitly labelled as demo data.
- Enquiry links render only when `SHOP_CONTACT_EMAIL` is configured with a valid non-placeholder address.
- `/api/health` is a liveness endpoint. `/api/ready` checks database connectivity plus required auth/contact configuration while returning minimal public detail by default.

## Toolchain

- Node.js 24.20.0 LTS
- pnpm 10.0.0
- Next.js 16.3.3
- NextAuth.js 4.24.15
- React 19.2.8
- Prisma 7.10.0 / PostgreSQL
- Vitest 4.1.11

## Local setup

Use the Node version in `.nvmrc` so development, CI and production stay on the same supported LTS line.

```bash
corepack enable
pnpm run preflight
pnpm install
pnpm -C apps/web exec prisma generate
pnpm dev
```

The app runs at `http://localhost:3001`.

For a browsable local demo without PostgreSQL, set `ENABLE_STARTER_CATALOG=true`. This switch is ignored in production.

## Environment configuration

Create `apps/web/.env.local` for local development. Production values belong in the deployment platform's configuration store.

Required for production admin/catalogue operation:

- `DATABASE_URL` — PostgreSQL connection URL.
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — random secret of at least 32 characters.
- `ADMIN_EMAIL` — valid administrator login email.
- `ADMIN_PASSWORD` — administrator password of at least 16 characters.
- `SHOP_CONTACT_EMAIL` — valid public ordering/enquiry address.

Optional:

- `PRISMA_ACCELERATE_URL` — reserved for Prisma deployment configuration.
- `TRUST_PROXY_HEADERS=true` — only when the deployment reverse proxy is known to overwrite/sanitise `x-forwarded-for` / `x-real-ip`; otherwise these headers are not trusted for throttling identity.
- `READINESS_DETAILS=true` — expose readiness dependency detail; leave false for a public health endpoint unless operations require it.
- `ENABLE_STARTER_CATALOG=true` — development/demo only; ignored under `NODE_ENV=production`.

CI placeholder values, malformed email addresses, weak admin passwords and short auth secrets are explicitly rejected by runtime-auth checks. Admin JWT authority expires after eight hours and is invalidated when configured admin credentials rotate.

The in-process limiter is deliberately bounded and is a secondary control only. Multi-instance or serverless production should also enforce authentication and write throttling at the trusted edge/CDN/WAF.

## Database migrations

The repository contains a reviewed initial PostgreSQL migration under `apps/web/prisma/migrations`. It includes database-level range constraints for catalogue prices and stock as well as the unique slug/index constraints represented by the Prisma model.

For a new database:

```bash
pnpm -C apps/web exec prisma migrate deploy
```

If an existing database was created with `prisma db push`, do not run the initial migration blindly. Compare the live schema with `schema.prisma`, back up the database, and baseline it deliberately before using `prisma migrate deploy`.

## Dependency security

CI fails on high-severity package advisories. Narrow pnpm overrides are currently used for patched transitive releases of `picomatch`, `lodash`, and `deepmerge-ts` where upstream dependency chains have not yet resolved to the fixed versions. Remove each override when the direct upstream package incorporates the fixed dependency and the audit remains clean.

## Verification

```bash
pnpm run preflight
pnpm install --frozen-lockfile
pnpm audit --audit-level high --ignore-registry-errors
pnpm -C apps/web exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm run doctor
```

Pull requests are expected to keep all CI gates green. Security/configuration changes also require the repository's `ALLOW_CONFIG_CHANGE` PR acknowledgement. GitHub Actions used by the hardened workflows are pinned to full commit SHAs.

## Security

See [`SECURITY.md`](SECURITY.md). Real secrets must never be committed.
