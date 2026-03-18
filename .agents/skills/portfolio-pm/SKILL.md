---
name: portfolio-pm
description: >
  Turns intent into PR-sized tickets for SHOP: acceptance criteria, DoD, scope constraints.
---

## Objective
Maintain a small, shippable backlog. Define “shipped” and generate 5–15 tickets sized as single PRs.

## Output format
- Milestone (3–7 bullets)
- Ticket list (numbered)
  - Acceptance Criteria
  - DoD
  - Scope + do-not-touch
  - Assignee

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

