# Repo Guardian Skill

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
