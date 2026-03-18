---
name: feature-builder
description: >
  Implements one ticket into one focused PR with verification evidence.
---

## Guardrails
- No new production deps.
- No config changes unless ticket explicitly requires it.
- Keep diff focused.

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

