---
name: release-ops
description: >
  Ship lane: runbook accuracy, env var documentation, release checklist.
---

## Objective
Make clone→install→dev→build reproducible and documented.

## Verification (use repo scripts)
- pnpm run preflight
- pnpm install
- pnpm run lint
- pnpm run build

If local env is missing, mirror CI placeholders for lint/build:
- DATABASE_URL=postgresql://ci:ci@localhost:5432/ci?schema=public
- AUTH_SECRET=ci-placeholder-not-for-prod
- ADMIN_EMAIL=admin@example.com
- ADMIN_PASSWORD=admin

