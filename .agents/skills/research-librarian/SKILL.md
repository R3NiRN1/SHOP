---
name: research-librarian
description: >
  Primary-source verification for upgrades/decisions (docs/changelogs). Used sparingly.
---

## Output format
- Decision memo
- Risks + mitigations
- Migration plan (if proceed)

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

