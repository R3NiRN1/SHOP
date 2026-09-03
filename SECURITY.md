# Security Policy

## Supported Versions

Security fixes are applied to the default branch. Production deployments should use a reviewed commit with green CI and current patched dependencies.

## Reporting a Vulnerability

Please use a private GitHub security advisory or contact the maintainers privately with reproduction steps and impact details. Do not publish credentials, customer data, or exploit details in a public issue.

## Environment and secrets

- Never commit real secrets or production database URLs.
- Keep production environment values in the deployment platform's secret/configuration store.
- CI values are deliberately recognised as placeholders and cannot enable runtime authentication.
- `AUTH_SECRET` must be at least 32 characters and `ADMIN_PASSWORD` at least 16 characters.
- Rotate `AUTH_SECRET` and `ADMIN_PASSWORD` if disclosure is suspected. Admin JWT authority is limited to eight hours and credential rotation invalidates existing admin role claims.
- Set `TRUST_PROXY_HEADERS=true` only behind a proxy/CDN that overwrites or sanitises forwarding headers.

The credentials provider is deliberately a single-administrator model. `ADMIN_PASSWORD` is read from the deployment secret store and compared in constant time; it is not a password database and does not provide password reset, MFA, account recovery, or multiple independently revocable administrators. A public or multi-operator deployment should prefer an external identity provider with MFA, or a separately reviewed stored-password design using a memory-hard password hash. In either case, keep server-side role checks and short-lived sessions.

## Baseline controls

- [x] Server-side ADMIN role enforcement for catalogue mutations.
- [x] Same-origin checks for authenticated catalogue writes.
- [x] Bounded application-level throttling for credential attempts and admin writes.
- [x] Bounded validation and normalisation of catalogue mutation input.
- [x] Exact two-decimal money parsing before Prisma persistence.
- [x] Database-level range constraints for price and stock.
- [x] Dependabot configuration and deterministic CodeQL workflow.
- [x] Reviewed Prisma migration history for new deployments.
- [x] Disposable PostgreSQL migration, persistence, uniqueness, not-found and database-constraint integration tests.
- [x] Standalone-runtime Chromium tests for public filtering, authentication, admin CRUD, origin checks, readiness and CSP.
- [x] Per-response nonce-based script policy with `strict-dynamic`, framing denial and no JavaScript `unsafe-inline`.
- [x] Public catalogue fails closed when its configured database is unavailable.
- [x] Production starter/sample inventory is disabled.
- [x] GitHub Actions in hardened workflows pinned to immutable commit SHAs.

## Deployment notes

The in-process rate limiter is a baseline control, not a distributed denial-of-service system. Multi-instance/serverless deployments should also enforce rate limits at the reverse proxy, CDN, WAF, or hosting platform. Forwarding headers are not used as client identity unless `TRUST_PROXY_HEADERS=true` is deliberately configured.

The Content Security Policy uses a new nonce per request, so affected pages are dynamically rendered and should not be cached as shared HTML. `script-src` does not permit `unsafe-inline`. `style-src` retains `unsafe-inline` because the built-in NextAuth credentials page emits an inline stylesheet; remove that allowance if the sign-in page is replaced with a nonce-compatible implementation.

Readiness responses expose only `ready` and `kind` by default. `READINESS_DETAILS=true` enables dependency-level status and should be used only when that information is appropriate for the endpoint's exposure.

The committed initial Prisma migration is for new PostgreSQL deployments. If a database already exists from `prisma db push`, inspect its schema and baseline migration history deliberately before running `prisma migrate deploy`; do not mark a migration applied without confirming the existing schema matches it. Use the guarded procedure in [`docs/RELEASE.md`](docs/RELEASE.md).
