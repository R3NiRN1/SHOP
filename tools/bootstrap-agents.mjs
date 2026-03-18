// tools/bootstrap-agents.mjs
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(relPath, content) {
  const full = path.resolve(process.cwd(), relPath);
  ensureDir(path.dirname(full));

  if (!FORCE && fs.existsSync(full)) {
    console.log(`SKIP  ${relPath} (exists)`);
    return;
  }

  if (DRY_RUN) {
    console.log(`WOULD ${relPath}`);
    return;
  }

  fs.writeFileSync(full, content, { encoding: "utf8" }); // utf8, no BOM
  console.log(`WRITE ${relPath}`);
}

function mustExist(relPath) {
  const full = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Expected to be run from repo root; missing: ${relPath}`);
  }
}

function main() {
  // sanity: this is SHOP
  mustExist("package.json");
  mustExist("apps/web/package.json");
  mustExist("pnpm-workspace.yaml");

  const files = {
    "AGENTS.md": `# SHOP — Agent Working Agreements

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
`,

    ".agents/skills/portfolio-pm/SKILL.md": `---
name: portfolio-pm
description: >
  Turns intent into small, PR-sized tickets for SHOP (acceptance criteria + DoD + scope).
---

## Objective
Maintain a tight backlog and define “shipped” milestones for SHOP.

## Output format
- Milestone definition (3–7 bullets)
- 5–15 tickets, each with:
  - Acceptance Criteria
  - Definition of Done (commands)
  - File scope + do-not-touch list
  - Assignee (feature-builder / debugger / ux-visual / release-ops)
`,

    ".agents/skills/repo-guardian/SKILL.md": `---
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
`,

    ".agents/skills/feature-builder/SKILL.md": `---
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
`,

    ".agents/skills/debugger/SKILL.md": `---
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
`,

    ".agents/skills/ux-visual/SKILL.md": `---
name: ux-visual
description: >
  UI/UX guidance (layout, typography, consistency, accessibility) for SHOP.
---

## Output format
- Recommendations
- Implementation-ready acceptance criteria (1–2 PRs worth)
`,

    ".agents/skills/release-ops/SKILL.md": `---
name: release-ops
description: >
  Makes SHOP runnable/shippable: runbook accuracy, env var docs, release checklist.
---

## Objective
Ensure a clean “ship lane” (clone → install → dev → build) with documented env expectations.
`,

    ".agents/skills/research-librarian/SKILL.md": `---
name: research-librarian
description: >
  Uses primary sources (official docs/changelogs) to de-risk upgrades and tooling decisions.
---

## Output format
- Decision memo
- Risks + mitigations
- Migration steps (if proceed)
`,

    ".github/pull_request_template.md": `## Summary
What changed and why.

## Acceptance Criteria
- [ ] List expected outcomes.

## Changes
- Files touched:
  - \`path\` — what changed

## Verification
Paste commands + results:

\`\`\`powershell
pnpm run preflight
pnpm install
pnpm run lint
pnpm run build
\`\`\`

## Risk & Rollback
- Risk:
- Rollback plan:
`,

    ".github/workflows/agent-contract.yml": `name: PR Contract Checks

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  pr-contract:
    runs-on: ubuntu-latest
    steps:
      - name: Require PR sections + guard risky file touches
        env:
          BODY: \${{ github.event.pull_request.body }}
          BASE: \${{ github.event.pull_request.base.sha }}
          HEAD: \${{ github.event.pull_request.head.sha }}
        run: |
          python - <<'PY'
          import os, subprocess, sys

          body = os.environ.get("BODY") or ""
          required = ["## Summary","## Acceptance Criteria","## Changes","## Verification","## Risk & Rollback"]
          missing = [h for h in required if h not in body]
          if missing:
            print("Missing required PR sections:")
            for h in missing: print(" -", h)
            sys.exit(1)

          subprocess.check_call(["git","init","-q"])
          # GitHub Actions runner checks out the repo automatically in many workflows,
          # but this job doesn't use actions/checkout to stay minimal.
          # If you want risky-file checks, add actions/checkout and remove this early exit:
          print("PR sections OK.")
          PY

      - uses: actions/checkout@v4

      - name: Risky file changes require explicit PR note
        env:
          BODY: \${{ github.event.pull_request.body }}
          BASE: \${{ github.event.pull_request.base.sha }}
          HEAD: \${{ github.event.pull_request.head.sha }}
        run: |
          python - <<'PY'
          import os, subprocess, sys

          body = os.environ.get("BODY") or ""
          base, head = os.environ["BASE"], os.environ["HEAD"]

          risky_exact = {
            "pnpm-workspace.yaml",
            "pnpm-lock.yaml",
            "next.config.js",
            "next.config.mjs",
            "turbo.json",
          }
          risky_prefixes = [".github/workflows/"]

          touched = subprocess.check_output(["git","diff","--name-only",f"{base}..{head}"], text=True).splitlines()
          risky = []
          for f in touched:
            if f in risky_exact or any(f.startswith(p) for p in risky_prefixes):
              risky.append(f)
          risky = sorted(set(risky))

          if risky and "ALLOW_CONFIG_CHANGE" not in body:
            print("Risky files changed. Add 'ALLOW_CONFIG_CHANGE' to PR body to acknowledge.")
            for f in risky: print(" -", f)
            sys.exit(1)

          print("Risky file check OK.")
          PY
`,

    "docs/RUNBOOK.md": `# SHOP Runbook

## Quick start (PowerShell)
\`\`\`powershell
corepack enable
pnpm run preflight
pnpm install
pnpm dev
\`\`\`

App: http://localhost:3001

## Verification
\`\`\`powershell
pnpm run lint
pnpm run build
\`\`\`

## Env
Copy \`apps/web/.env.example\` → \`apps/web/.env\` and fill values. Do not commit secrets.
`,

    "docs/HANDOVER.md": `# SHOP Handover

- Workspace: pnpm
- App: apps/web (Next on port 3001)
- Env vars: see apps/web/.env.example
- Prisma note: local DB access may require a driver adapter or PRISMA_ACCELERATE_URL.
`,

    "docs/DECISIONS.md": `# Decisions

- YYYY-MM-DD: <decision> — <why>
`,
  };

  for (const [p, c] of Object.entries(files)) writeFile(p, c);
  console.log(DRY_RUN ? "\nDry run complete." : "\nBootstrap complete.");
  console.log("Tip: rerun with --force to overwrite existing scaffold files.");
}

main();