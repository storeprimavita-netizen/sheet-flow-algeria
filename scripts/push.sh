#!/usr/bin/env bash
# Push the current branch when it is already committed (the merge in /ship).
# For agents whose sandbox blocks raw `git push` (Codex). Commits go through
# scripts/step.sh; this only pushes. Refuses main, never forces.
# Usage: scripts/push.sh
set -uo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 0 ] || { echo "REFUSED  scripts/push.sh takes no arguments — it pushes the current branch"; exit 1; }
branch=$(git branch --show-current)
case "$branch" in
  v3|v3-*) ;;
  *) echo "REFUSED  branch '$branch' is not v3 or v3-<id>"; exit 1 ;;
esac
if git push -q -u origin "$branch" 2>"${TMPDIR:-/tmp}/mnw-push.log"; then
  echo "PUSHED  $branch $(git log --oneline -1 | cut -c1-80)"
else
  echo "PUSH FAILED (see ${TMPDIR:-/tmp}/mnw-push.log) — git pull --rebase and retry, never force"
  tail -n 3 "${TMPDIR:-/tmp}/mnw-push.log" | cut -c1-160
  exit 2
fi
