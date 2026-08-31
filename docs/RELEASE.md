# SHOP release procedure

This document defines the minimum release path for the current enquiry-based SHOP application. A successful build is not, by itself, approval to deploy.

## Release gates

A release candidate is eligible for deployment only when all of the following are true:

1. The source commit is on `main` and its CI and Security Scan / CodeQL runs are green.
2. The `Release Build` workflow succeeds for that exact source commit or release tag.
3. The generated archive checksum is retained with the artifact and verified before deployment.
4. Production runtime configuration is complete and uses real secrets; CI/example placeholders are not permitted.
5. The target PostgreSQL database has been backed up and its live schema has been compared with `apps/web/prisma/schema.prisma`.
6. Any database created previously with `prisma db push` has been deliberately baselined before `prisma migrate deploy` is used.
7. Migrations have been tested against a non-production PostgreSQL database representative of production.
8. The deployment edge/reverse proxy provides TLS, request-size/timeout controls and distributed rate limiting. The application's in-process limiter is only a secondary control.
9. `/api/health` returns HTTP 200 after deployment and `/api/ready` returns HTTP 200 only after database, auth and contact configuration are genuinely ready.
10. Admin authentication and create/edit/delete/publish operations have been smoke-tested against the deployed environment before public promotion.

## Build artifact

The application uses Next.js standalone output. `Release Build` creates a Linux x64 archive named from the source commit and includes a SHA-256 checksum. The bundle contains the traced application runtime, Next static assets, and a copy of the reviewed Prisma schema/migrations for release traceability.

The workflow smoke-tests the packaged server itself. It requires:

- `/api/health` to return a valid liveness response;
- `/` to render successfully while the database is unavailable; and
- `/api/ready` to return HTTP 503 when no live database is present, proving that the release bundle still fails closed.

The build uses only CI placeholder configuration. Do not treat its successful smoke test as evidence that production secrets, database connectivity or mail/enquiry configuration are correct.

## Production configuration

Required runtime values:

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET` (at least 32 characters)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (at least 16 characters)
- `SHOP_CONTACT_EMAIL`

Set `TRUST_PROXY_HEADERS=true` only when the deployment proxy is known to overwrite/sanitise forwarding headers. Leave `ENABLE_STARTER_CATALOG` disabled in production. Leave `READINESS_DETAILS` disabled on a public readiness endpoint unless operations explicitly require dependency details.

No real secrets belong in the repository, build logs or release artifacts.

## Database sequencing

For a new PostgreSQL database, apply the committed migrations before starting the application:

```bash
pnpm -C apps/web exec prisma migrate deploy
```

For an existing database with no Prisma migration history, do not run that command until the schema has been backed up, compared and baselined. The initial migration is not a safe blind retrofit to an unknown live database.

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

## Rollback

Keep the previous application artifact available until post-deployment verification is complete. If application verification fails, restore the previous artifact while preserving the database unless a separately reviewed data-aware rollback migration exists.

If readiness fails because configuration or the database is unavailable, correct that dependency rather than enabling starter/demo catalogue data in production.

## Current known release blockers

Until resolved with deployment-specific evidence, the following remain blockers to a real production release:

- the live production PostgreSQL schema and migration history have not been inspected or baselined;
- the production hosting/reverse-proxy platform has not been identified in this repository;
- distributed edge rate limiting has not been configured or verified;
- production secrets/contact configuration have not been verified;
- there are no end-to-end/browser tests or real PostgreSQL integration tests;
- the repository `secure` ruleset still needs repository-settings review so `main` is actually covered by required PR/status/code-scanning protections.

These items do not prevent creation of a release candidate artifact; they prevent claiming that artifact is production-deployable.
