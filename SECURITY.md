# Security Policy

## Supported Versions

Security fixes are applied to the default branch. Production deployments should use a reviewed commit with green CI and current patched dependencies.

## Reporting a Vulnerability

Please use a private GitHub security advisory or contact the maintainers privately with reproduction steps and impact details. Do not publish credentials, customer data, or exploit details in a public issue.

## Environment and secrets

- Never commit real secrets or production database URLs.
- Keep production environment values in the deployment platform's secret/configuration store.
- CI values are deliberately recognised as placeholders and cannot enable runtime authentication.
- Rotate `AUTH_SECRET` and `ADMIN_PASSWORD` if disclosure is suspected.

## Baseline controls

- [x] Server-side ADMIN role enforcement for catalogue mutations.
- [x] Application-level throttling for credential attempts and admin writes.
- [x] Bounded validation and normalisation of catalogue mutation input.
- [x] Dependabot and CodeQL scanning.
- [x] Reviewed Prisma migration history for new deployments.
- [x] Public catalogue fails closed when its configured database is unavailable.
- [x] Production starter/sample inventory is disabled.

## Deployment notes

The in-process rate limiter is a baseline control, not a distributed denial-of-service system. Multi-instance/serverless deployments should also enforce rate limits at the reverse proxy, CDN, WAF, or hosting platform.

The committed initial Prisma migration is for new PostgreSQL deployments. If a database already exists from `prisma db push`, inspect its schema and baseline migration history deliberately before running `prisma migrate deploy`; do not mark a migration applied without confirming the existing schema matches it.
