---
name: feature-builder
description: >
  Implements one ticket into one focused PR with verification evidence.
---

## Guardrails
- No new production deps.
- No config changes unless ticket explicitly requires it.
- Keep diff focused; avoid formatting-only churn.

## Verification
- pnpm run preflight
- pnpm install
- pnpm run lint
- pnpm run build
