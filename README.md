# SHOP

A Next.js seed catalogue/storefront with protected catalogue, stock and order administration. Manual orders and stock adjustments work with PostgreSQL; hosted Stripe card checkout is optional and disabled by default.

The previous build is recorded as a **v1 proof of concept**, with its tested scope and limits in [the v1 record](docs/V1_POC_AND_NEXT_BUILD.md). This branch implements [issue #81](https://github.com/R3NiRN1/SHOP/issues/81).

## Runtime model

- Public catalogue reads expose only `Variety.published = true` records.
- Catalogue writes live under `/api/admin/*` and require an authenticated `ADMIN` session plus same-origin mutation checks.
- Each HTML response receives a fresh Content Security Policy nonce. Scripts must come from this application and carry that nonce; framing and plugin content are denied.
- Production database failure fails closed: sample inventory is never substituted.
- Starter entries are available only when `ENABLE_STARTER_CATALOG=true` outside production, and are explicitly labelled as demo data.
- Enquiry links render only when `SHOP_CONTACT_EMAIL` is configured with a valid non-placeholder address.
- `/api/health` is a liveness endpoint. `/api/ready` checks database connectivity, required auth/contact configuration and payment configuration when checkout is enabled; public detail is minimal by default.
- Admin stock counts and signed adjustments leave a ledger. Manual orders deduct stock on confirmation; hosted checkout reserves stock until Stripe confirms payment or expiry. Refunds return stock only when the administrator explicitly requests restocking.

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
- `PAYMENTS_ENABLED=true` — opt in to hosted Stripe Checkout. Requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXTAUTH_URL` and `SHOP_DELIVERY=collection` or `shipping`. For shipping set `SHOP_SHIPPING_PENCE` to a whole number of pence. Leave disabled for manual sales.
- `SHOP_ALLOW_LIVE_PAYMENTS=true` — separate explicit activation required with an `sk_live_` key and an HTTPS origin. Never use live credentials for local testing.

For Stripe test mode, use a Stripe test account and `sk_test_` key. Register a webhook for `/api/payments/webhook` with `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated` and `refund.failed`; use its matching `whsec_` secret. In local development, forward test webhooks to `http://localhost:3001/api/payments/webhook` with the Stripe CLI. Use Stripe test cards only. The server verifies the raw signed body, restricts checkout to cards, and reconciles uncertain provider responses from Admin → Orders. An order in REVIEW or REFUND_PENDING needs operator review; do not fulfil it until resolved. The browser order page is tied to a browser-only cookie; admin orders retain the durable record. A local database alone does not make Stripe checkout operational.

CI placeholder values, malformed email addresses, weak admin passwords and short auth secrets are explicitly rejected by runtime-auth checks. The current authentication model is one administrator whose email and plaintext password are supplied by the deployment secret store. Password comparison is constant-time, admin JWT authority expires after eight hours, and changing the configured admin credentials invalidates existing admin role claims. This is intentionally not a multi-user identity system.

The in-process limiter is deliberately bounded and is a secondary control only. Multi-instance or serverless production should also enforce authentication and write throttling at the trusted edge/CDN/WAF.

## Database migrations

The repository contains the initial PostgreSQL migration and a forward migration for orders, payment records, and stock history under `apps/web/prisma/migrations`. Existing stock counts are carried forward with opening ledger entries. Back up the database and rehearse this migration against a restored copy before applying it to existing data.

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

The pull-request suite additionally deploys committed migrations to PostgreSQL 17.6 and runs persistence/constraint integration tests. Playwright builds and exercises the standalone release runtime with Chromium, including authentication, admin catalogue and stock workflows, public filtering, same-origin rejection, readiness, and CSP nonces. Live provider payment processing requires a separate Stripe test account and signed webhook verification before activation.

Pull requests are expected to keep all CI gates green. Security/configuration changes also require the repository's `ALLOW_CONFIG_CHANGE` PR acknowledgement. GitHub Actions used by the hardened workflows are pinned to full commit SHAs.

## Security

See [`SECURITY.md`](SECURITY.md). Real secrets must never be committed.
