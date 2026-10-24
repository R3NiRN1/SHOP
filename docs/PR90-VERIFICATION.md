# PR #90 verification

Verified locally on 24 October 2026 against PR dependency commit `8e1433c` plus the dependency and security fixes in this change. Merge is authorized once the updated CI checks pass.

## Changes

- Permit build scripts only for installed Prisma CLI and engines version 7.10.1, matching the lockfile.
- Resolve release-manifest application versions from installed packages in `apps/web`, including packages that hide package.json behind exports. Missing or invalid metadata fails the script before it emits output.
- Cover rejected administrator credentials without database writes, nested transactions with reused options, rollback, and subsequent independent commits.
- Allow 15 seconds for Node subprocess tests after reproducible five-second timeouts on this Windows host. Assertions are unchanged.
- Patch Vitest, Vite, Zod and fast-uri; update Next and its ESLint plugin to 16.4.3 and lodash to 4.18.1. Remove the stale picomatch override that caused a peer warning.
- Remove the obsolete audit exception; enforce audits at every severity and fail on registry errors.
- Replace fast SHA-256 hashing in transient credential comparison with direct length-checked `timingSafeEqual`; test equal-length mismatches and UTF-8 credentials.
- Deduplicate Dependabot workspace configuration, ignore browser output, freeze setup installs, and prune generated directories before Windows preflight traversal.

## Actual results

Environment: Windows x64, Node 24.20.0, pnpm 11.25.0, isolated PostgreSQL 18 on loopback port 55490. Test migrations were applied to a fresh `shop_test` database owned by `shop_test`.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS after corrected approvals; Prisma lifecycle scripts ran; lockfile unchanged |
| `pnpm audit --audit-level low` | PASS: zero vulnerabilities at every severity, no exceptions |
| `pnpm peers check` | PASS: no peer dependency issues |
| `pnpm run preflight` | PASS with generated directories pruned before traversal |
| `pnpm -C apps/web exec prisma generate` | PASS: client 7.10.1 |
| `pnpm -C apps/web lint` | PASS |
| `pnpm -C apps/web typecheck` | PASS |
| `pnpm -C apps/web test` | PASS: 18 tests; 7 PostgreSQL tests intentionally skipped in the unit run |
| `pnpm -C apps/web test:integration` with integration environment enabled | PASS: all 7 tests, including authentication and transaction regression |
| `pnpm -C apps/web build` | PASS: Next.js 16.4.3 standalone output |
| `pnpm -C apps/web test:e2e` | PASS: all 3 Chromium tests against standalone output, including failed login, unauthenticated writes and authenticated CRUD |

Installed manifest versions: Next 16.4.3, next-auth 4.24.15, React 19.3.1, Prisma 7.10.1.

Initial runs exposed the outdated approvals, package export restrictions in manifest resolution, and five-second subprocess/database test timeouts. Manifest resolution and subprocess timeouts were fixed. The unchanged database timeout passed on rerun.

The optimized PowerShell preflight was also exercised against temporary fixtures: generated dependency files were excluded, a real foreign lockfile was rejected, and a BOM in workspace YAML was rejected. The final Chromium rerun passed all three tests on Next.js 16.4.3.

## Remaining blockers and limits

- All 13 prior npm audit findings are resolved. The publisher withdrew GHSA-vfj7-8cjw-p6xm on 23 October 2026 as not practically exploitable; its obsolete GitHub alert was dismissed for that documented reason, and the audit exception was removed.
- GitHub secret scanning and push protection are enabled for this public repository. The initial secret scan returned no alerts. CodeQL must confirm the credential-comparison fix before merge.
- Local tests used PostgreSQL 18; CI uses PostgreSQL 17.6. CI confirmation is still required.
- Windows standalone build and browser runtime passed. Linux x64 archive assembly, checksum and extracted-archive smoke checks remain for the Release Build workflow; this local result does not certify that Linux artifact.

## Branch synchronization

Fetched and pruned origin, checked out the exact PR branch with upstream tracking, and confirmed local main matches origin/main. Removed two local branches already merged into main: `chore/add-pr-template-agent-contract` and `codex/develop-usable-mvp`.

Remote branches already merged into main and eligible for owner review: `chore/add-pr-template-agent-contract`, `codex/add-specialist-agent-skills`, `codex/audit-shop-repo-for-windows-11-setup`, `codex/develop-usable-mvp`, `codex/postgres-integration-20260902`. Remote branches and unmerged local work were retained.

## Risk and rollback

No production schema or authentication implementation changed. Revert this fix commit to restore the prior workflow and tests; doing so also restores the known Prisma approval failure. Release only after the dependency audit and Linux workflow pass. Post-release checks should cover liveness, database readiness, rejected login and administrator CRUD.
