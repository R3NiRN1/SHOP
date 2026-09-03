# SHOP release procedure

This document defines the minimum release path for the current enquiry-based SHOP application. A successful build is not, by itself, approval to deploy.

## Release gates

A release candidate is eligible for deployment only when all of the following are true:

1. The source commit is on `main`; Windows CI, PostgreSQL integration, Browser E2E, Security Scan / CodeQL, Release Build, and the PR contract are green.
2. The `Release Build` workflow succeeds for that exact source commit or release tag.
3. The generated archive checksum and `RELEASE-MANIFEST.txt` are retained with the artifact and verified before deployment.
4. Production runtime configuration is complete and uses real secrets; CI/example placeholders are not permitted.
5. The target PostgreSQL database has been backed up and its live schema has been compared with `apps/web/prisma/schema.prisma`.
6. Any database created previously with `prisma db push` has been deliberately baselined before `prisma migrate deploy` is used.
7. Migrations have been tested against a restored non-production PostgreSQL database representative of production. The blank-database PostgreSQL CI gate is necessary but does not prove an unknown existing schema is safe to baseline.
8. The deployment edge/reverse proxy provides TLS, request-size/timeout controls and distributed rate limiting. The application's in-process limiter is only a secondary control.
9. `/api/health` returns HTTP 200 after deployment and `/api/ready` returns HTTP 200 only after database, auth and contact configuration are genuinely ready.
10. Admin authentication and create/edit/delete/publish operations have been smoke-tested against the deployed environment before public promotion.
11. A full-history secret scan over all reachable branches and tags reports no live credentials. Any finding is rotated first and removed from history under a separately reviewed incident plan.

## Build artifact

The application uses Next.js standalone output. `Release Build` creates a Linux x64 archive named from the source commit and includes a SHA-256 checksum. The bundle contains the traced application runtime, Next static assets, and a copy of the reviewed Prisma schema/migrations for release traceability.

The workflow smoke-tests the packaged server itself. It requires:

- `/api/health` to return a valid liveness response;
- `/` to render successfully while the database is unavailable; and
- `/api/ready` to return HTTP 503 when no live database is present, proving that the release bundle still fails closed.

The build uses only CI placeholder configuration. Do not treat its successful smoke test as evidence that production secrets, database connectivity or mail/enquiry configuration are correct.

Download the GitHub Actions artifact into an otherwise empty directory, then verify and extract both archive layers without restoring build-runner ownership:

```bash
zip_archives=(shop-web-*.zip)
test "${#zip_archives[@]}" -eq 1
unzip "${zip_archives[0]}"
archives=(shop-web-*-linux-x64.tar.gz)
test "${#archives[@]}" -eq 1
sha256sum --check "${archives[0]}.sha256"
mkdir release
tar --extract --gzip --file "${archives[0]}" --directory release --no-same-owner
cd release/apps/web
PORT=3001 HOSTNAME=127.0.0.1 node server.js
```

The service manager must inject production environment values, restart the process on failure, capture stdout/stderr, and terminate it gracefully during replacement. Put a TLS reverse proxy in front of the bound internal address. Do not expose this example bind address as a complete production topology.

An artifact with green checks may be labelled as a release candidate. It must not be described as production-ready while any item under **Current known release blockers** remains unresolved.

## Production configuration

Required runtime values:

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET` (at least 32 characters)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (at least 16 characters)
- `SHOP_CONTACT_EMAIL`
- `NEXTAUTH_URL` — the canonical public HTTPS origin, for example `https://shop.example`.

Set `TRUST_PROXY_HEADERS=true` only when the deployment proxy is known to overwrite/sanitise forwarding headers. Leave `ENABLE_STARTER_CATALOG` disabled in production. Leave `READINESS_DETAILS` disabled on a public readiness endpoint unless operations explicitly require dependency details.

No real secrets belong in the repository, build logs or release artifacts.

## Database sequencing

For a new PostgreSQL database, apply the committed migrations before starting the application:

```bash
pnpm -C apps/web exec prisma migrate deploy
```

For an existing database with no Prisma migration history, the initial migration is not a safe blind retrofit. A database operator must complete this sequence:

1. Identify the actual provider, PostgreSQL version, maintenance window, connection/pooling path, backup mechanism and restore owner.
2. Take a provider-native backup and prove it can be restored to an isolated non-production database. A schema-only dump is useful for comparison but is not a recoverable data backup.
3. Inspect the live `_prisma_migrations` table. Record whether it is absent, empty, or already contains migration history; do not overwrite existing history.
4. Export the live schema without data and compare tables, columns, enum values, defaults, constraints, indexes and foreign keys with `apps/web/prisma/schema.prisma` and `apps/web/prisma/migrations/20260831003000_initial_production_baseline/migration.sql`.
5. Restore the backup into an isolated database and repeat the comparison there. Resolve every mismatch with a separately reviewed forward migration or data repair; do not edit the committed initial migration after it has been used.
6. Only when the restored and live schemas are confirmed equivalent to the initial migration, record that migration as applied against the isolated copy:

   ```bash
   pnpm -C apps/web exec prisma migrate resolve --applied 20260831003000_initial_production_baseline
   pnpm -C apps/web exec prisma migrate status
   pnpm -C apps/web exec prisma migrate deploy
   ```

7. Exercise readiness, public reads, administrator authentication and catalogue CRUD against the isolated copy. Review query/application logs for schema errors.
8. During the approved production window, repeat only the already-rehearsed baseline/status/deploy sequence with the verified production connection, then retain command output with the release evidence.

Do not run `migrate resolve --applied` merely to silence a migration failure. It asserts that the database already contains the migration's effects.

Database rollback must be data-aware. Reverting application code does not automatically undo a schema migration safely.

## Deployment verification

After deployment, check in this order:

```text
GET /api/health  -> 200
GET /api/ready   -> 200
GET /             -> 200
GET /varieties    -> 200
```

Then authenticate as the configured administrator and exercise one controlled non-public variety through create, edit, publish/unpublish and delete. Confirm that an unauthenticated mutation is rejected and that unpublished records do not appear publicly.

Also inspect the HTML response's `Content-Security-Policy` header. Confirm script nonces are present and differ between requests, the canonical HTTPS origin works for authenticated writes, and a conflicting `Origin` is rejected. Do not place nonce-bearing HTML in a shared cache.

## Rollback

Keep the previous application artifact available until post-deployment verification is complete. If application verification fails, restore the previous artifact while preserving the database unless a separately reviewed data-aware rollback migration exists.

If readiness fails because configuration or the database is unavailable, correct that dependency rather than enabling starter/demo catalogue data in production.

## Current known release blockers

Until resolved with deployment-specific evidence, the following remain blockers to a real production release:

- the live production PostgreSQL schema and migration history have not been inspected or baselined;
- the production hosting/reverse-proxy platform has not been identified in this repository;
- distributed edge rate limiting has not been configured or verified;
- production secrets/contact configuration have not been verified;
- restore rehearsal and migration verification against a production-representative database have not been documented;
- the repository `secure` ruleset still needs repository-settings review so `main` is actually covered by required PR/status/code-scanning protections.

These items do not prevent creation of a release candidate artifact; they prevent claiming that artifact is production-deployable.
