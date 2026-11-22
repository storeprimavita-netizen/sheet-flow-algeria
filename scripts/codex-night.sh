#!/usr/bin/env bash
# Keep the loop running with OpenAI Codex CLI, one task per fresh session, in
# THIS terminal. Waits and retries when a usage limit is hit.
#
#   scripts/codex-night.sh                    main agent: any task, database tasks included
#   scripts/codex-night.sh codex-2 nodb       extra agent: only tasks without a migration
#   scripts/codex-night.sh codex nodb 3       stop after 3 tasks
#   Ctrl+C                                    stop (pushed steps are kept)
#
#   CODEX_MODEL=<id>          model id (default: the one Codex uses for your plan / your /model choice)
#   CODEX_EFFORT=medium       thinking level for building (low | medium | high …)
#   CODEX_TASK_MINUTES=120    time limit per task
#   CODEX_FLAGS="…"           extra flags passed to `codex exec`
#
# Works with the Codex program inside the ChatGPT app — no separate install.
# Checked 2026-11-22 against Codex 0.171: the flags exist, the account answers,
# the project settings and rules load. No whole task has been run with it yet.
# Before the first night run: scripts/codex-setup.sh must end with READY.
set -uo pipefail
cd "$(dirname "$0")/.."
name=${1:-codex}; filter=${2:-}; max=${3:-0}
case "$filter" in ""|nodb) ;; *) echo "usage: scripts/codex-night.sh [name] [nodb] [max tasks]"; exit 1 ;; esac
logdir="$HOME/Library/Logs"; mkdir -p "$logdir"
say() { echo "$(date '+%H:%M') ── [$name] $*"; }

app_cli="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"   # the Codex program inside the ChatGPT app
if command -v codex >/dev/null 2>&1; then cx=codex; elif [ -x "$app_cli" ]; then cx="$app_cli"; else say "Codex not found — install the ChatGPT desktop app, see docs/CODEX.md"; exit 1; fi
"$cx" login status >/dev/null 2>&1 || { say "not signed in — sign in inside the ChatGPT app (or: codex login)"; exit 1; }
[ -d node_modules ] || { say "node_modules missing — run: npm ci"; exit 1; }
caffeinate -ims -w $$ &
[ "$filter" = "nodb" ] && export GATE_SKIP_LIVE=1
last=$(mktemp)
trap 'rm -f "$last"; scripts/dev-down.sh >/dev/null 2>&1' EXIT   # never leave the dev server running after a run
trap 'echo; say "stopped by you — pushed steps are kept"; exit 130' INT TERM

bad=0; n=0; waits=0
while :; do
  [ "$max" -gt 0 ] && [ "$n" -ge "$max" ] && { say "$max task(s) done — stopping as asked."; break; }
  n=$((n+1))
  cur=$(git branch --show-current)
  # A session cut off mid-task leaves edits on v3-<id>; save them there or the checkout fails.
  if [ "$cur" != "v3" ] && [ -n "$(git status --porcelain)" ]; then say "uncommitted files on $cur — saving them as a step"; scripts/step.sh "wip: files left on $cur when a Codex session was cut off (not gated)" || exit 1; fi
  [ "$cur" = "v3" ] || git checkout -q v3 || { say "cannot switch to v3 — stopping"; exit 1; }
  if [ -n "$(git status --porcelain)" ]; then say "leftover files — set aside with git stash"; git stash push -u -q -m "codex leftovers $(date +%F-%H%M)" || exit 1; fi
  git pull --rebase -q origin v3 || { say "could not update v3 — retrying in 5 min"; n=$((n-1)); sleep 300; continue; }
  log="$logdir/mnw-codex-$name-$(date +%Y%m%d-%H%M%S).log"; : > "$last"
  say "task $n (model: ${CODEX_MODEL:-Codex default}, effort: ${CODEX_EFFORT:-medium})   log: $log"
  start=$(date +%s)
  # --trust: project settings, rules and reviewers under .codex/ load only for a trusted folder.
  # approval "never": nobody is there to answer; what the rules do not allow simply fails.
  # shellcheck disable=SC2086
  perl -e 'alarm shift; exec @ARGV' "$(( ${CODEX_TASK_MINUTES:-120} * 60 ))" \
    "$cx" exec --trust --sandbox workspace-write -c 'approval_policy="never"' \
      -c "model_reasoning_effort=\"${CODEX_EFFORT:-medium}\"" ${CODEX_MODEL:+-m "$CODEX_MODEL"} \
      -o "$last" ${CODEX_FLAGS:-} \
      "\$loop-auto — use the loop-auto skill with arguments: 1 $filter as:$name. Run exactly one task of the plan, then stop." \
      </dev/null 2>&1 | tee "$log"
  took=$(( $(date +%s) - start ))
  end_txt=$(tail -c 3000 "$last" 2>/dev/null); [ -n "$end_txt" ] || end_txt=$(tail -c 3000 "$log")

  if echo "$end_txt" | grep -q "RUN-END: nothing-eligible"; then say "nothing left this agent can do without the owner. Done."; break; fi
  if echo "$end_txt" | grep -q "RUN-END: hard-stop"; then say "hard stop — read the run report at the end of PROGRESS.md."; break; fi
  if echo "$end_txt" | grep -q "RUN-END: more"; then bad=0; waits=0; say "task finished in $((took/60)) min — next"; continue; fi
  tail_txt=$(tail -c 4000 "$log")
  if echo "$tail_txt" | grep -Eqi "not logged in|login required|401 unauthorized|please log in"; then say "not signed in — run: codex login"; break; fi
  if echo "$tail_txt" | grep -Eqi "usage limit|rate limit|quota|try again (in|at)|429|limit reached"; then
    waits=$((waits+1)); n=$((n-1))
    say "usage limit reached — waiting 30 min, then continuing (wait $waits). $(echo "$tail_txt" | grep -Eio 'try again (in|at)[^.]{0,60}' | head -1)"
    sleep 1800; bad=0; continue
  fi
  bad=$((bad+1))
  [ "$bad" -ge 3 ] && { say "3 sessions in a row ended without a result — stopping. Last lines:"; tail -n 12 "$log" | cut -c1-200; break; }
  say "session ended without a result after ${took}s — retrying in 5 min ($bad/3)"; n=$((n-1)); sleep 300
done
git log --oneline -5
scripts/dev-down.sh     # do not leave the dev server spinning after the run
