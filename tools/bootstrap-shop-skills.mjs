// tools/bootstrap-shop-skills.mjs
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeFile(rel, content) {
  const full = path.resolve(process.cwd(), rel);
  ensureDir(path.dirname(full));
  if (!FORCE && fs.existsSync(full)) return console.log(`SKIP  ${rel}`);
  fs.writeFileSync(full, content, { encoding: "utf8" });
  console.log(`WRITE ${rel}`);
}

function mustExist(rel) {
  if (!fs.existsSync(path.resolve(process.cwd(), rel))) {
    throw new Error(`Run from repo root; missing ${rel}`);
  }
}

mustExist(".agents/skills/README.md"); // confirms you're on new scaffolded main

const commonVerify = `## Verification (use repo scripts)
- pnpm run preflight
- pnpm install
- pnpm run lint
- pnpm run build

If local env is missing, mirror CI placeholders for lint/build:
- DATABASE_URL=postgresql://ci:ci@localhost:5432/ci?schema=public
- AUTH_SECRET=ci-placeholder-not-for-prod
- ADMIN_EMAIL=admin@example.com
- ADMIN_PASSWORD=admin
`;

const skills = {
  "portfolio-pm": `---\nname: portfolio-pm\ndescription: >\n  Turns intent into PR-sized tickets for SHOP: acceptance criteria, DoD, scope constraints.\n---\n\n## Objective\nMaintain a small, shippable backlog. Define “shipped” and generate 5–15 tickets sized as single PRs.\n\n## Output format\n- Milestone (3–7 bullets)\n- Ticket list (numbered)\n  - Acceptance Criteria\n  - DoD\n  - Scope + do-not-touch\n  - Assignee\n\n${commonVerify}\n`,
  "repo-guardian": `---\nname: repo-guardian\ndescription: >\n  Health audit + triage for SHOP (P0/P1/P2). Tiny safe PRs only.\n---\n\n## Objective\nKeep repo continuously shippable: preflight/install/lint/build, plus CI drift checks.\n\n## Guardrails\n- No broad refactors.\n- No dependency upgrades unless requested.\n- Prefer issue/triage if fix isn’t obviously safe.\n\n${commonVerify}\n`,
  "feature-builder": `---\nname: feature-builder\ndescription: >\n  Implements one ticket into one focused PR with verification evidence.\n---\n\n## Guardrails\n- No new production deps.\n- No config changes unless ticket explicitly requires it.\n- Keep diff focused.\n\n${commonVerify}\n`,
  "debugger": `---\nname: debugger\ndescription: >\n  Repro-first debugging: hypotheses, instrumentation, minimal fix PR.\n---\n\n## Rules\n- Reproduce first.\n- List 3–7 hypotheses.\n- Instrument to narrow cause.\n- Minimal patch; no rewrite-as-fix.\n\n${commonVerify}\n`,
  "ux-visual": `---\nname: ux-visual\ndescription: >\n  UI/UX consistency for SHOP (layout, typography, accessibility). No feature creep.\n---\n\n## Output format\n- Recommendations\n- Implementation-ready acceptance criteria (1–2 PRs)\n\n${commonVerify}\n`,
  "release-ops": `---\nname: release-ops\ndescription: >\n  Ship lane: runbook accuracy, env var documentation, release checklist.\n---\n\n## Objective\nMake clone→install→dev→build reproducible and documented.\n\n${commonVerify}\n`,
  "research-librarian": `---\nname: research-librarian\ndescription: >\n  Primary-source verification for upgrades/decisions (docs/changelogs). Used sparingly.\n---\n\n## Output format\n- Decision memo\n- Risks + mitigations\n- Migration plan (if proceed)\n\n${commonVerify}\n`,
};

for (const [name, content] of Object.entries(skills)) {
  writeFile(`.agents/skills/${name}/SKILL.md`, content);
}

console.log("Done.");