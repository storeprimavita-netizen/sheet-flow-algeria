#!/usr/bin/env bash
# Keep the loop running, batch after batch, in THIS terminal (foreground, readable
# output). Waits out usage limits and continues by itself. Keeps the Mac awake.
#
#   scripts/night-run.sh                 one task per fresh session until nothing is eligible
#   scripts/night-run.sh STORE-3 CONF-1  only these tasks, then stop
#   Ctrl+C                          stop (the task in progress keeps its pushed steps)
#
# Each batch is a fresh Claude session (`claude -p "/auto N"`), so context never
# fills up. Ends when: nothing is eligible · a hard stop · 3 broken starts in a row.
# Results: "Run report" blocks in PROGRESS.md; questions in docs/QUESTIONS.md.
# Transcripts: ~/Library/Logs/mnw-night-run-*.jsonl
# Lid: keep it open, or run `sudo pmset -a disablesleep 1` first (undo with 0).
set -uo pipefail
cd "$(dirname "$0")/.."
batch=${1:-1}
# Task ids instead of a number → run exactly those, in order, then stop:
#   scripts/night-run.sh STORE-3 CONF-1
ids=(); case "${1:-}" in ""|*[!0-9]*) [ $# -gt 0 ] && ids=("$@") ;; esac
say() { echo "$(date '+%H:%M') ── $*"; }

command -v claude >/dev/null 2>&1 || { say "claude CLI not found"; exit 1; }
caffeinate -ims -w $$ &            # no idle/disk/system sleep while this script lives

seconds_until() {                  # "5:20pm" → seconds from now (next occurrence)
  python3 -I - "$1" <<'PY'
import sys, re, datetime
m = re.match(r"(\d{1,2})(?::(\d{2}))?\s*([ap]m)", sys.argv[1].lower())
if not m: print(1200); raise SystemExit
h, mi, ap = int(m.group(1)) % 12, int(m.group(2) or 0), m.group(3)
if ap == "pm": h += 12
now = datetime.datetime.now()
t = now.replace(hour=h, minute=mi, second=0, microsecond=0)
if t <= now: t += datetime.timedelta(days=1)
print(int((t - now).total_seconds()) + 120)
PY
}

bad=0; n=0
while :; do
  n=$((n+1))
  cur=$(git branch --show-current)
  # A batch cut off mid-task (usage limit) leaves edits on v3-<id>; save them there or the checkout fails.
  if [ "$cur" != "v3" ] && [ -n "$(git status --porcelain)" ]; then say "uncommitted files on $cur — saving them as a step"; scripts/step.sh "wip: files left on $cur when batch $((n-1)) was cut off (not gated)" || exit 1; fi
  [ "$cur" = "v3" ] || git checkout -q v3 || { say "cannot switch to v3 — stopping"; exit 1; }
  if [ -n "$(git status --porcelain)" ]; then say "leftover files from an interrupted task — set aside with git stash (see: git stash list)"; git stash push -u -q -m "night-run leftovers $(date +%F-%H%M)" || exit 1; fi
  git pull --rebase -q origin v3 || { say "could not update v3 — stopping"; exit 1; }
  log="$HOME/Library/Logs/mnw-night-run-$(date +%Y%m%d-%H%M%S).jsonl"
  if [ ${#ids[@]} -gt 0 ]; then [ $n -le ${#ids[@]} ] || { say "all listed tasks handled: ${ids[*]}"; break; }; batch=${ids[$((n-1))]}; fi
  say "batch $n: /auto $batch   (transcript: $log)"
  start=$(date +%s)
  env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT \
    claude -p "/auto $batch" --permission-mode auto --output-format stream-json --verbose </dev/null 2>&1 \
    | tee "$log" | python3 -u scripts/fmt-stream.py
  took=$(( $(date +%s) - start ))
  outcome=$(python3 -I scripts/run-outcome.py "$log")
  case "$outcome" in
    LIMIT*)
      reset=${outcome#LIMIT }; [ "$reset" = "-" ] && reset=""
      wait_s=$(seconds_until "$reset")
      say "usage limit reached${reset:+ — resets $reset}. Waiting $((wait_s/60)) min, then continuing."
      sleep "$wait_s"; bad=0; continue ;;
    NOTHING)  say "nothing left that can run without you — see docs/QUESTIONS.md and the Owner inputs table. Done."; break ;;
    HARDSTOP) say "hard stop — read the run report at the end of PROGRESS.md."; break ;;
  esac
  if [ "$took" -lt 180 ]; then
    bad=$((bad+1)); [ "$bad" -ge 3 ] && { say "3 batches in a row ended in under 3 minutes — stopping. Last lines:"; tail -c 600 "$log"; break; }
    say "batch ended after ${took}s — retrying in 10 min ($bad/3)"; sleep 600; continue
  fi
  bad=0
  say "batch $n finished in $((took/60)) min — starting the next one"
done
git log --oneline -6
