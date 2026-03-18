---
name: repo-guardian
description: >
  Health audit + triage for SHOP (P0/P1/P2). Tiny safe PRs only.
---

## Objective
Keep repo continuously shippable: preflight/install/lint/build, plus CI drift checks.

## Guardrails
- No broad refactors.
- No dependency upgrades unless requested.
- Prefer issue/triage if fix isn’t obviously safe.

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

