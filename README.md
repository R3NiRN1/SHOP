# SHOP

A small Next.js seed catalogue/storefront with a protected catalogue-admin surface. The current ordering path is enquiry-based; checkout and payment processing are not implemented.

## Runtime model

- Public catalogue reads expose only `Variety.published = true` records.
- Catalogue writes live under `/api/admin/*` and require an authenticated `ADMIN` session plus same-origin mutation checks.
- Each HTML response receives a fresh Content Security Policy nonce. Scripts must come from this application and carry that nonce; framing and plugin content are denied.
- Production database failure fails closed: sample inventory is never substituted.
- Starter entries are available only when `ENABLE_STARTER_CATALOG=true` outside production, and are explicitly labelled as demo data.
- Enquiry links render only when `SHOP_CONTACT_EMAIL` is configured with a valid non-placeholder address.
- `/api/health` is a liveness endpoint. `/api/ready` checks database connectivity plus required auth/contact configuration while returning minimal public detail by default.

## Toolchain

- Node.js 24.20.0 LTS
- pnpm 11.25.0
- Next.js 16.3.4
- NextAuth.js 4.24.15
- React 19.2.8
- Prisma 7.10.0 / PostgreSQL
- Vitest 4.1.11

## Local setup

Use the Node version in `.nvmrc` and the package-manager version pinned in `package.json` so development, CI and production stay on the same supported toolchain.

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

Create `apps/web/.env.local` for local development. Production values belong in the deployment platform's secret/configuration store.

Required for production admin/catalogue operation:

- `DATABASE_URL` — PostgreSQL connection URL.
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — random secret of at least 32 characters.
- `ADMIN_EMAIL` — valid administrator login email.
- `ADMIN_PASSWORD` — administrator password of at least 16 characters.
- `SHOP_CONTACT_EMAIL` — valid public ordering/enquiry address.
- `NEXTAUTH_URL` — canonical public HTTPS origin for the deployed application.

Optional:

- `PRISMA_ACCELERATE_URL` — reserved for Prisma deployment configuration.
- `TRUST_PROXY_HEADERS=true` — only when the deployment reverse proxy is known to overwrite/sanitise `x-forwarded-for` / `x-real-ip`; otherwise these headers are not trusted for throttling identity.
- `READINESS_DETAILS=true` — expose readiness dependency detail; leave false for a public health endpoint unless operations require it.
- `ENABLE_STARTER_CATALOG=true` — development/demo only; ignored under `NODE_ENV=production`.

CI placeholder values, malformed email addresses, weak admin passwords and short auth secrets are explicitly rejected by runtime-auth checks. The current authentication model is one administrator whose email and plaintext password are supplied by the deployment secret store. Password comparison is constant-time, admin JWT authority expires after eight hours, and changing the configured admin credentials invalidates existing admin role claims. This is intentionally not a multi-user identity system.

The in-process limiter is deliberately bounded and is a secondary control only. Multi-instance or serverless production should also enforce authentication and write throttling at the trusted edge/CDN/WAF.

## Database migrations

The repository contains a reviewed initial PostgreSQL migration under `apps/web/prisma/migrations`. It includes database-level range constraints for catalogue prices and stock as well as the unique slug/index constraints represented by the Prisma model.

For a new database:

```bash
pnpm -C apps/web exec prisma migrate deploy
```

If an existing database was created with `prisma db push`, do not run the initial migration blindly or mark it applied by assumption. Back it up, inspect its `_prisma_migrations` history, compare a schema-only dump with both `schema.prisma` and `20260831003000_initial_production_baseline/migration.sql`, and rehearse on a restored non-production copy. Only after the existing schema is confirmed equivalent may an operator record the initial migration as applied with `prisma migrate resolve --applied 20260831003000_initial_production_baseline`. The complete guarded procedure is in [`docs/RELEASE.md`](docs/RELEASE.md).

## Dependency security

CI fails on high-severity package advisories. Narrow pnpm overrides are currently used for audited transitive releases of `picomatch`, `lodash`, `deepmerge-ts`, `browserslist`, `mysql2`, `@babel/core`, and `@humanfs/node` where upstream dependency chains have not yet resolved to the required version. Remove an override only when the direct upstream package incorporates an acceptable dependency and both the frozen install and audit remain clean.

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

The pull-request suite additionally deploys the committed migration to PostgreSQL 17.6 and runs persistence/constraint integration tests. Playwright builds and exercises the exact standalone release runtime with Chromium, including authentication, admin CRUD, public filtering, same-origin rejection, readiness, and CSP nonces.

Pull requests are expected to keep all CI gates green. Security/configuration changes also require the repository's `ALLOW_CONFIG_CHANGE` PR acknowledgement. GitHub Actions used by the hardened workflows are pinned to full commit SHAs.

## Security

See [`SECURITY.md`](SECURITY.md). Real secrets must never be committed.
