#!/usr/bin/env bash
# Keep the loop running with Google Antigravity CLI (agy), one task per fresh
# session, in THIS terminal. Waits and retries when a usage limit is hit.
#
#   scripts/agy-night.sh                      main agent: any task, database tasks included
#   scripts/agy-night.sh agy-2 nodb           extra agent: only tasks without a migration
#   Ctrl+C                                    stop (pushed steps are kept)
#
#   AGY_MODEL=gemini-3.8-flash-high           model id from `agy models` (default: best available for the
#                                             `task` role in .agents/models.conf; after a usage limit the next one)
#   AGY_EFFORT=high                           thinking level, when the model has one
#   AGY_FLAGS="--sandbox"                     extra flags passed to agy
#
# NOT TESTED when written (agy was not installed on this Mac). Flags come from
# antigravity.google/docs/cli (read 2026-11-20). First run: do one task by hand
# in the TUI (`agy`, then `/loop-auto 1`) to see rules, skills and permissions work.
# Headless agy refuses silently anything it has no permission for and still
# exits 0 — set the allow rules first: docs/ANTIGRAVITY.md → Permissions.
set -uo pipefail
cd "$(dirname "$0")/.."
name=${1:-agy-1}; filter=${2:-}
skip=0   # how many models of the `task` row are out of quota right now
pick_model() { if [ -n "${AGY_MODEL:-}" ]; then echo "$AGY_MODEL"; else scripts/agy-run.sh chain task 2>/dev/null | sed -n "$((skip+1))p"; fi; }
logdir="$HOME/Library/Logs"; mkdir -p "$logdir"
say() { echo "$(date '+%H:%M') ── [$name] $*"; }

command -v agy >/dev/null 2>&1 || { say "agy is not installed — see docs/ANTIGRAVITY.md"; exit 1; }
[ -d node_modules ] || { say "node_modules missing — run: npm ci"; exit 1; }
caffeinate -ims -w $$ &
trap 'scripts/dev-down.sh >/dev/null 2>&1' EXIT INT TERM   # never leave the dev server running after a run
[ "$filter" = "nodb" ] && export GATE_SKIP_LIVE=1

bad=0; n=0
while :; do
  n=$((n+1))
  [ "$(git branch --show-current)" = "v3" ] || git checkout -q v3 || { say "cannot switch to v3 — stopping"; exit 1; }
  if [ -n "$(git status --porcelain)" ]; then say "leftover files — set aside with git stash"; git stash push -u -q -m "agy leftovers $(date +%F-%H%M)" || exit 1; fi
  git pull --rebase -q origin v3 || { say "could not update v3 — retrying in 5 min"; sleep 300; continue; }
  [ "$skip" -gt 0 ] && [ $(( $(date +%s) - ${skip_since:-0} )) -gt 18000 ] && skip=0   # limits refresh every five hours
  model=$(pick_model); [ -z "$model" ] && [ "$skip" -gt 0 ] && { skip=0; model=$(pick_model); }
  log="$logdir/mnw-agy-$name-$(date +%Y%m%d-%H%M%S).log"
  say "task $n (model: ${model:-agy default})   log: $log"
  start=$(date +%s)
  # shellcheck disable=SC2086
  agy -p "Use the loop-auto skill with arguments: 1 $filter as:$name" \
      ${model:+--model "$model"} ${AGY_EFFORT:+--effort "$AGY_EFFORT"} --print-timeout 120m ${AGY_FLAGS:-} </dev/null 2>&1 | tee "$log"
  took=$(( $(date +%s) - start ))
  tail_txt=$(tail -c 4000 "$log")

  if echo "$tail_txt" | grep -q "RUN-END: nothing-eligible"; then say "nothing left this agent can do without the owner. Done."; break; fi
  if echo "$tail_txt" | grep -q "RUN-END: hard-stop"; then say "hard stop — read the run report at the end of PROGRESS.md."; break; fi
  if echo "$tail_txt" | grep -q "RUN-END: more"; then bad=0; say "task finished in $((took/60)) min — next"; continue; fi
  if echo "$tail_txt" | grep -Eqi "authentication required|not signed in|login required"; then say "not signed in — run \`agy\` once and sign in, then start again."; break; fi
  if echo "$tail_txt" | grep -Eqi "quota|usage limit|rate limit|resource.?exhausted|limit reached|429"; then
    skip=$((skip+1)); skip_since=$(date +%s); next=$(pick_model)
    if [ -n "$next" ] && [ -z "${AGY_MODEL:-}" ]; then say "usage limit on $model — switching to $next"; bad=0; continue; fi
    skip=0; say "usage limit on every model — waiting 20 min, then trying again from the best one"; sleep 1200; bad=0; continue
  fi
  bad=$((bad+1))
  [ "$bad" -ge 3 ] && { say "3 runs in a row ended without a result — stopping. Last lines:"; tail -n 12 "$log"; break; }
  say "run ended without a result after ${took}s — retrying in 5 min ($bad/3)"; sleep 300
done
git log --oneline -5
scripts/dev-down.sh     # do not leave the dev server spinning after the run
