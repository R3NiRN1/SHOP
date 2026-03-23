#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repoRoot, '.agents', 'skills');

const skills = {
  'portfolio-pm': `# Portfolio PM Skill

## When to use
Use this skill when you need to shape multi-step work across the SHOP repository, align proposed changes with business outcomes, or turn a high-level ask into an execution-ready plan.

## Responsibilities
- Clarify goals, constraints, and success metrics before implementation starts.
- Break larger efforts into milestones, acceptance criteria, and dependencies.
- Surface delivery risks, rollout considerations, and open questions early.

## Workflow
1. Restate the requested outcome, target users, and non-goals.
2. Identify impacted areas of the repo and any cross-team dependencies.
3. Convert the request into prioritized milestones with acceptance criteria.
4. Recommend the smallest shippable increment and note follow-up work separately.

## Output checklist
- Problem statement and desired outcome.
- Scope boundaries and assumptions.
- Acceptance criteria and verification plan.
- Risks, dependencies, and suggested sequencing.
`,
  'repo-guardian': `# Repo Guardian Skill

## When to use
Use this skill when making repository changes that could affect standards, safety rails, CI behavior, or long-term maintainability.

## Responsibilities
- Protect the existing control plane contract and repository guardrails.
- Check proposed edits for scope creep, unsafe side effects, and policy drift.
- Recommend minimal, reviewable changes that are easy to audit.

## Workflow
1. Read the governing instructions for the paths you will touch.
2. Confirm the requested scope and explicitly list files that are allowed to change.
3. Review the planned diff for policy, security, and maintenance concerns.
4. Call out anything that should be split into a separate change before proceeding.

## Output checklist
- In-scope file list.
- Guardrails or policies considered.
- Risks introduced and how they are mitigated.
- Follow-up items that were intentionally deferred.
`,
  'feature-builder': `# Feature Builder Skill

## When to use
Use this skill when implementing a new product capability, extending an existing flow, or adding repository assets that support a feature rollout.

## Responsibilities
- Translate requirements into concrete file changes.
- Prefer incremental implementation that is easy to review and verify.
- Keep code, docs, and support assets aligned with the requested feature scope.

## Workflow
1. Identify the smallest functional slice that satisfies the request.
2. Inspect nearby patterns and follow existing repository conventions.
3. Implement the change with clear naming and minimal collateral edits.
4. Run targeted checks for the touched files and summarize the result.

## Output checklist
- Files added or updated.
- Key implementation decisions.
- Validation performed.
- Known gaps or future enhancements.
`,
  'debugger': `# Debugger Skill

## When to use
Use this skill when diagnosing a failing workflow, reproducing a bug, or explaining the root cause of unexpected behavior in the SHOP repository.

## Responsibilities
- Reproduce issues with the lightest-weight checks possible.
- Narrow the failure to a specific component, assumption, or regression.
- Document root cause, fix options, and confidence level.

## Workflow
1. Capture the observed failure, expected behavior, and reproduction steps.
2. Gather evidence from logs, tests, diffs, and relevant source files.
3. Form and test the smallest plausible hypotheses first.
4. Propose or implement the least risky fix, then re-run the key verification.

## Output checklist
- Reproduction steps.
- Evidence gathered.
- Root cause and fix summary.
- Remaining uncertainty and next checks, if any.
`,
  'ux-visual': `# UX Visual Skill

## When to use
Use this skill when refining user-facing flows, copy, layout, or visual presentation for web experiences in the SHOP repository.

## Responsibilities
- Keep user journeys coherent, accessible, and visually consistent.
- Evaluate whether a change is perceptible enough to require screenshots.
- Highlight UX tradeoffs, empty states, and edge-case presentation.

## Workflow
1. Identify the user scenario, affected screens, and desired visual outcome.
2. Review existing patterns for spacing, hierarchy, copy tone, and accessibility.
3. Make the smallest visual change that improves clarity or usability.
4. Capture verification evidence, including screenshots when the UI changes are perceptible.

## Output checklist
- User scenario addressed.
- Visual or copy changes made.
- Accessibility or consistency considerations.
- Screenshot and verification notes when applicable.
`,
  'release-ops': `# Release Ops Skill

## When to use
Use this skill when preparing a change for release, documenting rollout steps, or checking that a repository update is operationally safe to merge.

## Responsibilities
- Assess blast radius, rollout sequencing, and rollback options.
- Verify that release notes, migration steps, and operational checks are captured.
- Keep release guidance concise and actionable for maintainers.

## Workflow
1. Summarize what is changing and who will be affected.
2. Identify any deployment, configuration, or coordination requirements.
3. Define verification steps for pre-merge and post-deploy confidence.
4. Document rollback guidance and any monitoring expectations.

## Output checklist
- Release impact summary.
- Rollout or coordination steps.
- Verification and monitoring guidance.
- Rollback plan.
`,
  'research-librarian': `# Research Librarian Skill

## When to use
Use this skill when collecting repository context, comparing local patterns, or building a source-backed summary before making changes in SHOP.

## Responsibilities
- Gather the minimum source material needed to answer the question or support the task.
- Prefer authoritative repository sources and cite them clearly.
- Distill findings into actionable guidance without flooding the context window.

## Workflow
1. Define the question to answer and the evidence needed.
2. Search the repository for the most relevant files, examples, and conventions.
3. Summarize the findings with explicit references to the source material.
4. Note any gaps, ambiguities, or assumptions that still need confirmation.

## Output checklist
- Question investigated.
- Sources reviewed.
- Findings and recommended next step.
- Open questions or assumptions.
`
};

await mkdir(skillsRoot, { recursive: true });

for (const [name, content] of Object.entries(skills)) {
  const skillDir = path.join(skillsRoot, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
}

console.log(`Created ${Object.keys(skills).length} SHOP skill(s) in ${skillsRoot}`);
