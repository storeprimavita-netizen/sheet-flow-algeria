#!/usr/bin/env bash
# Unattended run of loop v3 with Claude Code, keeping the Mac awake meanwhile.
# Usage: scripts/night-run.sh [N | task-id]        (default: 6 tasks)
#   Start it and walk away:  nohup scripts/night-run.sh 8 >/dev/null 2>&1 &
# Result: the "Run report" block at the end of PROGRESS.md (also pushed to v3).
# Full transcript: ~/Library/Logs/mnw-night-run-<timestamp>.jsonl
#
# Keep the Mac plugged in with the lid OPEN. The screen may dim and lock —
# that does not stop the run; system sleep would, and caffeinate blocks it.
set -uo pipefail
cd "$(dirname "$0")/.."
arg=${1:-6}
log="$HOME/Library/Logs/mnw-night-run-$(date +%Y%m%d-%H%M).jsonl"
say() { echo "$(date '+%H:%M:%S') $*" | tee -a "${log%.jsonl}.txt"; }

command -v claude >/dev/null 2>&1 || { say "claude CLI not found"; exit 1; }
[ "$(git branch --show-current)" = "v3" ] || git checkout -q v3 || { say "cannot switch to v3"; exit 1; }
[ -z "$(git status --porcelain)" ] || { say "working tree not clean — commit or stash first"; exit 1; }
git pull --rebase -q origin v3 || { say "could not update v3"; exit 1; }

say "starting local stack"
scripts/dev-up.sh | tee -a "${log%.jsonl}.txt"

say "loop start: /auto $arg  (transcript: $log)"
# -i idle sleep, -m disk sleep, -s system sleep (on AC). Display may sleep.
# CLAUDECODE is unset so this also works when started from inside a session.
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT \
  caffeinate -ims claude -p "/auto $arg" --permission-mode auto \
  --output-format stream-json --verbose >"$log" 2>&1
code=$?
say "loop ended (exit $code)"
git status -sb | head -3 | tee -a "${log%.jsonl}.txt"
git log --oneline -8 | tee -a "${log%.jsonl}.txt"
