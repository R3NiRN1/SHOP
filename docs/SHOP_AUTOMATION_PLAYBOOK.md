# SHOP autonomous development playbook

**Owner intent:** advance the SHOP roadmap with minimal coordination overhead while protecting security, existing data and manual release control.

## On each scheduled run

1. Read programme #98, `docs/SHOP_DELIVERY_ROADMAP.md`, `AGENTS.md`, and current open issues/PRs on `R3NiRN1/SHOP`.
2. Check the latest completed CI/security results for `main` and active relevant PR heads. First investigate regressions or repeated failure noise; avoid disabling tests/audits to stop notifications.
3. Assess dependency blockers. Start with #99 and PR #94; compare PR #82 with main before any order/inventory work. Reuse prior validated code.
4. Pick exactly one small, currently unblocked task with a measurable result. If coding tools, repository writes or test tools are available, implement on a new branch, add tests and open/continue a scoped PR. If only read access is available, provide a concrete reviewed patch plan and clearly mark it unimplemented.
5. Wait for or inspect relevant GitHub checks where possible. Correct test failures attributable to the change; do not manufacture pass claims. Report precise PR/commit/check status.
6. Update the relevant issue with actual delivered work, remaining checks and any blocker. Do not claim an entire milestone completed after only one increment.

## Non-negotiable constraints

- No unattended merge, release, data migration against real databases, live checkout, billing action, credential access/disclosure or account provisioning.
- No automatic deletion of user data or existing catalogue/seed-lot records.
- No change that weakens authentication, authorisation, dependency audit, CSP, backup or test gates solely to make CI green.
- Migrations require additive-first design, explicit mapping of old stock semantics, disposable-database rehearsal and rollback note.
- Changing role permissions or payment flows requires explicit owner review and negative test cases.
- Keep changes scoped. Rebase on current main instead of force-pushing; no parallel edits to the same file without reconciliation.
- Distinguish code written, tests observed and production behaviour verified.

## Report shape

Respond with: **Completed:** link and evidence; **Tests:** exact passed/failed/pending; **Next:** one issue; **Owner input needed:** only if a real irreversible decision blocks progress. If no work could be performed, state the blocker and don't imply progress.

## First slice

Issue #99: audit PR #94 guided installer on current main, identify code that should be adopted/rebased and write a minimal passing pilot-verification PR. Preserve existing local databases. A review-only run is valuable if code can’t be modified safely yet.
