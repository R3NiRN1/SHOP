#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Agent control plane scaffold is present in: ${repo_root}"
echo "Review AGENTS.md, docs/agent-control-plane.md, and .github/workflows/agent-contract.yml to customize the contract."
