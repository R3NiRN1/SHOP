# SHOP — Agent Working Agreements

## Repo facts (grounded in this repo)
- pnpm workspace (root packageManager: pnpm@10)
- App: apps/web (Next), dev server on port 3001
- Root scripts proxy to apps/web:
  - preflight, dev, build, start, lint

## Safety and scope
- No broad refactors unless explicitly requested.
- No new production dependencies without explicit approval.
- Avoid config churn (workspace config, Next config, lockfiles, workflows) unless ticket explicitly requires it.
- Never commit secrets. If any are found, stop and report paths.

## Definition of Done (mandatory)
- PR includes: Summary, Acceptance Criteria, Verification, Risk/Rollback.
- Default verification commands (unless ticket says otherwise):
  - pnpm run preflight
  - pnpm install
  - pnpm run lint
  - pnpm run build
- If auth/db changes: update docs + .env.example guidance only (never commit real secrets).

## Work style
- One ticket → one branch/worktree → one PR.
- If uncertain: reproduce + instrument first; minimal patch; no rewrite-as-fix.
