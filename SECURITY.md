# Security Policy

## Supported Versions

This repository tracks security fixes on the default branch. Keep dependencies updated and prefer the latest release.

## Reporting a Vulnerability

Please open a private security advisory or contact the maintainers with reproduction steps and impact details.

## Environment & Secrets Policy

- **Never** commit real secrets to the repository.
- Use local `.env` files for development only.
- CI uses placeholder environment values for build/lint only. Runtime auth still requires real secrets.

## Baseline Hardening Checklist

- [ ] Enforce RBAC server-side for admin routes.
- [ ] Add rate limiting to auth and write APIs.
- [ ] Validate and sanitize all user input.
- [ ] Enable dependency and CodeQL scanning.
- [ ] Review Prisma migrations before deployment.
