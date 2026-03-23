# AGENTS.md

## Purpose
This repository uses an agent control plane scaffold so automated contributors have a predictable contract for planning, editing, verification, and pull request hygiene.

## Guardrails
- Keep changes scoped to the task being requested.
- Prefer small, reviewable commits.
- Run targeted checks for the files you modify.
- Do not include unrelated local or stashed work in commits.

## Required PR sections
Pull requests should include Summary, Acceptance Criteria, Changes, Verification, and Risk & Rollback.

## Skills
Agent-facing skills live under `.agents/skills/` and document reusable workflows for repository tasks.
