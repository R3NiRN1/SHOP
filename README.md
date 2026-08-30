# SHOP

A small Next.js seed catalogue/storefront with a protected catalogue-admin surface. The current ordering path is enquiry-based; checkout and payment processing are not implemented.

## Runtime model

- Public catalogue reads expose only `Variety.published = true` records.
- Catalogue writes live under `/api/admin/*` and require an authenticated `ADMIN` session.
- Production database failure fails closed: sample inventory is never substituted.
- Starter entries are available only when `ENABLE_STARTER_CATALOG=true` outside production, and are explicitly labelled as demo data.
- Enquiry links render only when `SHOP_CONTACT_EMAIL` is configured with a non-placeholder address.
- `/api/health` is a liveness endpoint. `/api/ready` checks database connectivity plus required auth/contact configuration.

## Toolchain

- Node.js 20.19.0
- pnpm 10.0.0
- Next.js 16.3.3
- NextAuth.js 4.24.15
- Prisma 7.5.0 / PostgreSQL
- Vitest 4.1.11

## Local setup

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
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — strong random NextAuth secret.
- `ADMIN_EMAIL` — administrator login email.
- `ADMIN_PASSWORD` — strong administrator password.
- `SHOP_CONTACT_EMAIL` — real public ordering/enquiry address.

Optional:

- `PRISMA_ACCELERATE_URL` — reserved for Prisma deployment configuration.
- `ENABLE_STARTER_CATALOG=true` — development/demo only; ignored under `NODE_ENV=production`.

CI placeholder values are explicitly rejected by runtime-auth checks.

## Database migrations

The repository now contains a reviewed initial PostgreSQL migration under `apps/web/prisma/migrations`.

For a new database:

```bash
pnpm -C apps/web exec prisma migrate deploy
```

If an existing database was created with `prisma db push`, do not run the initial migration blindly. Compare the live schema with `schema.prisma`, back up the database, and baseline it deliberately before using `prisma migrate deploy`.

## Verification

```bash
pnpm run preflight
pnpm install --frozen-lockfile
pnpm -C apps/web exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm run doctor
```

Pull requests are expected to keep all CI gates green. Security/configuration changes also require the repository's `ALLOW_CONFIG_CHANGE` PR acknowledgement.

## Security

See [`SECURITY.md`](SECURITY.md). Real secrets must never be committed.
