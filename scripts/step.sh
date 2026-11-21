#!/usr/bin/env bash
# Commit and push one finished step. Shared by every agent (Claude Code,
# Codex, Antigravity) so "commit and push on every step" is one enforced path.
# Usage: scripts/step.sh "<commit message>" ["<co-author line>"]
# Refuses on main, refuses on a secret hit, never force-pushes.
set -uo pipefail
cd "$(dirname "$0")/.."
msg=${1:?usage: scripts/step.sh "<commit message>" ["Co-Authored-By: ..."]}
coauthor=${2:-}
branch=$(git branch --show-current)
case "$branch" in
  main|master|"") echo "REFUSED  never commit steps on '$branch' — work on v3 or v3-<id>"; exit 1 ;;
  v3|v3-*) ;;
  *) echo "REFUSED  branch '$branch' is not v3 or v3-<id>"; exit 1 ;;
esac
git add -A
if git diff --cached --quiet; then echo "NOTHING  no changes to commit on $branch"; exit 0; fi
scripts/secret-scan.sh HEAD || { git reset -q; echo "REFUSED  secret scan failed — nothing committed"; exit 1; }
if [ -n "$coauthor" ]; then git commit -q -m "$msg" -m "$coauthor"; else git commit -q -m "$msg"; fi || { echo "FAILED  commit"; exit 1; }
if git push -q -u origin "$branch" 2>"${TMPDIR:-/tmp}/mnw-step-push.log"; then
  echo "PUSHED  $branch $(git log --oneline -1 | cut -c1-80)"
else
  echo "COMMITTED locally, PUSH FAILED (see ${TMPDIR:-/tmp}/mnw-step-push.log) — pull --rebase and retry, never force"
  tail -n 3 "${TMPDIR:-/tmp}/mnw-step-push.log" | cut -c1-160
  exit 2
fi
