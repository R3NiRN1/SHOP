---
name: repo-guardian
description: >
  Audits SHOP health and produces triage (P0/P1/P2). Tiny safe PRs only.
---

## Default commands (from repo scripts)
- pnpm run preflight
- pnpm install
- pnpm run lint
- pnpm run build

## Guardrails
- No broad refactors.
- No dependency upgrades unless requested.
- Prefer issues/notes over risky changes.
