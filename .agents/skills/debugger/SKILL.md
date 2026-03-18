---
name: debugger
description: >
  Repro-first debugging, instrumentation, minimal fix PRs.
---

## Rules
- Reproduce first.
- List hypotheses.
- Instrument to narrow cause.
- Minimal fix, then re-verify.

## Verification
- rerun the failing command(s)
- plus: pnpm run lint + pnpm run build
