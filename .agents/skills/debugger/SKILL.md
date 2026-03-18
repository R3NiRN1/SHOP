---
name: debugger
description: >
  Repro-first debugging: hypotheses, instrumentation, minimal fix PR.
---

## Rules
- Reproduce first.
- List 3–7 hypotheses.
- Instrument to narrow cause.
- Minimal patch; no rewrite-as-fix.

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

