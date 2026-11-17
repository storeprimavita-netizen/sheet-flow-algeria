#!/usr/bin/env bash
# Headless Antigravity run of loop v3.
# Usage: scripts/agy-loop.sh [N | task-id]      (default: 1 task)
#   AGY_MODEL=<slug from `agy models`>  AGY_TIMEOUT=60m
# NOT TESTED when written: `agy` was not installed on this machine. Flags are
# from antigravity.google/docs/cli (read 2026-11-17) — run `agy --help` if one
# is rejected. Sign in once interactively (`agy`) before using headless mode.
set -uo pipefail
cd "$(dirname "$0")/.."
command -v agy >/dev/null 2>&1 || { echo "agy is not installed — see docs/ANTIGRAVITY.md"; exit 1; }
arg=${1:-1}
branch=$(git branch --show-current)
[ "$branch" = "v3" ] || { echo "start from branch v3 (currently on '$branch')"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree is not clean — commit or stash first"; exit 1; }
git pull --rebase -q origin v3 || { echo "could not update v3"; exit 1; }
[ -d node_modules ] || { echo "node_modules missing — run: npm ci"; exit 1; }

# Headless mode soft-denies anything that needs approval and still exits 0,
# so read the report it prints: a "stopped on" line is the real result.
agy -p "Use the loop-auto skill with argument: $arg" \
  --print-timeout "${AGY_TIMEOUT:-60m}" ${AGY_MODEL:+--model "$AGY_MODEL"}
echo "--- after run ---"
git status -sb | head -5
git log --oneline -5
