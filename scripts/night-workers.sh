#!/usr/bin/env bash
# Several agents building at the same time, each in its own copy of the project.
#
#   scripts/night-workers.sh setup [N]          create N extra copies (default 2): .worktrees/w2, w3
#   scripts/night-workers.sh start [programs]   start one run per program, all at once, in one tmux session.
#                                               Default: codex agy claude — Codex leads the main folder (all
#                                               tasks), Antigravity leads w2 and Claude leads w3 (tasks without
#                                               a database change). Each run builds with its lead program and
#                                               has its work reviewed by the other two; questions go to Fable.
#                                               A program that is not installed is skipped, never replaced.
#                                               Other mixes: `start codex claude` · `start codex codex`
#   scripts/night-workers.sh status             what each copy is doing, and what is claimed
#   scripts/night-workers.sh stop               stop all runs (pushed steps are kept)
#   scripts/night-workers.sh remove             delete the extra copies (pushed work is safe on GitHub)
#
# How they stay out of each other's way (same rules as scripts/agy-parallel.sh):
#   - every agent claims a row in docs/MASTER_PLAN.md on v3 and pushes the claim before building;
#   - extra agents only take tasks WITHOUT a migration (`nodb`): one agent at a time changes the
#     local database; their gate skips the live database tests, which the main agent runs on every merge;
#   - each copy is a full clone with its own node_modules; the app of each copy gets its own port
#     (scripts/dev-up.sh picks the next free one).
# Three programs = three separate usage limits, which is where the extra capacity comes from.
# Two runs led by the SAME program share one limit: they finish sooner, they do not do more.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
cmd=${1:-status}; session=mnw; tmpd=${TMPDIR:-/tmp}; tmpd=${tmpd%/}
copies() { ls -d "$root"/.worktrees/w[0-9]* 2>/dev/null || true; }

case "$cmd" in
  setup)
    n=${2:-2}; url=$(git remote get-url origin)
    [ -f .env.local ] || { echo "missing .env.local in the main folder"; exit 1; }
    mkdir -p .worktrees
    for k in $(seq 2 $((n+1))); do
      d=".worktrees/w$k"
      if [ -d "$d/.git" ]; then
        # an existing copy may hold work that is not pushed yet: never reset it
        if [ -n "$(git -C "$d" status --porcelain)" ] || [ -n "$(git -C "$d" log --branches --not --remotes --oneline | head -1)" ]; then echo "KEPT    $d has uncommitted or unpushed work — left as it is"
        else git -C "$d" fetch -q origin v3 && git -C "$d" checkout -q v3 && git -C "$d" pull -q --ff-only origin v3 && echo "updated $d" || echo "KEPT    $d could not be updated — left as it is"; fi
      else
        git clone -q --local --branch v3 "$root" "$d"; git -C "$d" remote set-url origin "$url"
        git -C "$d" fetch -q origin v3 && git -C "$d" reset -q --hard origin/v3; echo "cloned  $d"
      fi
      cp .env.local "$d/.env.local"
      [ -d "$d/node_modules" ] || { echo "installing packages in $d (about a minute)"; (cd "$d" && npm ci --silent >/dev/null 2>&1) || { echo "npm ci failed in $d"; exit 1; }; }
      if command -v graphify >/dev/null 2>&1; then (cd "$d" && GRAPHIFY_BACKEND=none graphify extract . --code-only >/dev/null 2>&1) && echo "mapped  $d (graphify)"; fi
      echo "ready   $d"
    done
    echo "next:   scripts/night-workers.sh start" ;;
  start)
    command -v tmux >/dev/null 2>&1 || { echo "tmux is not installed (brew install tmux) — or open one Terminal window per copy and run scripts/night.sh there"; exit 1; }
    shift; leads=${*:-codex agy claude}
    for lead in $leads; do case "$lead" in codex|agy|claude) ;; *) echo "unknown program '$lead' (codex | agy | claude)"; exit 1 ;; esac; done
    # runs that are already going are left alone; `start` only adds the ones that are missing (a run that was stopped)
    exists=0; tmux has-session -t "$session" 2>/dev/null && exists=1
    running() { [ "$exists" = 1 ] && tmux list-windows -t "$session" -F '#{window_name}' 2>/dev/null | grep -q "^$1-"; }
    have() { case "$1" in codex) command -v codex >/dev/null 2>&1 || [ -x "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex" ] ;; claude) command -v claude >/dev/null 2>&1 ;; agy) command -v agy >/dev/null 2>&1 && grep -q '"deny"' "$HOME/.gemini/antigravity-cli/settings.json" 2>/dev/null ;; *) return 1 ;; esac; }
    k=1; started=0
    for lead in $leads; do
      if [ "$k" = 1 ]; then d=$root; w=main; run="$lead"; what="all tasks, database tasks included"
      else d="$root/.worktrees/w$k"; w="w$k"; run="w$k-$lead nodb"; what="tasks without a database change"; fi
      if running "$w"; then echo "running $w   left as it is"; k=$((k+1)); continue; fi
      if ! have "$lead"; then
        if [ "$lead" = agy ] && command -v agy >/dev/null 2>&1; then echo "skipped $w   agy has no allow/deny rules yet — run once: scripts/agy-setup.sh --write-permissions"
        else echo "skipped $w   $lead is not installed or not signed in — this run is not started (docs/NIGHT.md)"; fi
        k=$((k+1)); continue; fi
      if [ "$k" != 1 ] && [ ! -d "$d/.git" ]; then echo "skipped $w   the copy $d does not exist — run: scripts/night-workers.sh setup"; k=$((k+1)); continue; fi
      # start the runner as it is on v3 (scripts/night.sh explains why): the folder may sit on an older task branch
      launcher="scripts/night.sh"; boot="$tmpd/mnw-boot-$w.sh"
      git -C "$d" fetch -q origin v3 2>/dev/null || true
      if git -C "$d" show origin/v3:scripts/night.sh > "$boot.new" 2>/dev/null && grep -q 'NIGHT_HOME' "$boot.new"; then mv -f "$boot.new" "$boot"; launcher="NIGHT_HOME='$d' bash '$boot'"; else rm -f "$boot.new"; fi
      run="STAGE_PREFER=$lead $launcher $run"
      # a run that has ended keeps its window (its last lines stay readable) under the name ended-<w>:
      # `start` and `status` then no longer take it for a run that is going
      tmux kill-window -t "$session:ended-$w" 2>/dev/null || true; tmux has-session -t "$session" 2>/dev/null || exists=0
      cmdline="$run; tmux rename-window -t \"\$TMUX_PANE\" 'ended-$w' 2>/dev/null; echo; echo '[$w ($lead) ended — press Enter to close]'; read -r _"
      if [ "$exists" = 0 ]; then tmux new-session -d -s "$session" -n "$w-$lead" -c "$d" "$cmdline"; exists=1; else tmux new-window -d -t "$session" -n "$w-$lead" -c "$d" "$cmdline"; fi
      started=$((started+1)); echo "started $w   led by $lead — $what; its work is reviewed by the other programs"
      k=$((k+1))
    done
    [ "$started" = 0 ] && { echo "nothing started"; exit 1; }
    # the way out is shown inside the view itself, on its bottom line
    tmux set-option -t "$session" status-right-length 80 >/dev/null 2>&1 || true
    tmux set-option -t "$session" status-right " leave: Ctrl+B then D  |  Ctrl+C STOPS this run " >/dev/null 2>&1 || true
    echo "watch:  tmux attach -t $session"
    echo "        leave the view: Ctrl+B, release, then D (the runs go on) · switch run: Ctrl+B then 0/1/2"
    echo "        Ctrl+C inside the view STOPS the run you are looking at — bring it back with: scripts/night-workers.sh start" ;;
  status)
    tmux has-session -t "$session" 2>/dev/null && tmux list-windows -t "$session" -F '#{window_name}' | sed -e 's/^ended-\(.*\)$/ended    \1   (scripts\/night-workers.sh start brings it back)/' -e t -e 's/^/running  /' || echo "no run started by this script"
    for d in "$root" $(copies); do
      [ -d "$d/.git" ] || [ -f "$d/.git" ] || continue
      label=$(basename "$d"); [ "$d" = "$root" ] && label=main
      printf '%-10s %-16s %s\n' "$label" "$(git -C "$d" branch --show-current)" "$(git -C "$d" log -1 --format='%cd %s' --date=format:'%H:%M' | cut -c1-70)"
    done
    git fetch -q origin v3 2>/dev/null || true
    echo "--- claimed now"; git show origin/v3:docs/MASTER_PLAN.md 2>/dev/null | awk -F'|' 'NF>9 && $(NF-1) ~ /claimed:/ {print $2 "|" $(NF-1)}' ;;
  stop)
    tmux has-session -t "$session" 2>/dev/null || { echo "nothing running"; exit 0; }
    for w in $(tmux list-windows -t "$session" -F '#{window_index}'); do tmux send-keys -t "$session:$w" C-c 2>/dev/null || true; done
    sleep 3; tmux kill-session -t "$session" 2>/dev/null || true
    echo "stopped — pushed steps are kept. A task that was in progress stays claimed and is continued by the next run with the same name." ;;
  remove)
    for d in $(copies); do
      if [ -n "$(git -C "$d" status --porcelain)" ] || [ -n "$(git -C "$d" log --branches --not --remotes --oneline | head -1)" ]; then echo "KEPT    $d has uncommitted or unpushed work — look at it first"; continue; fi
      rm -rf "$d"; echo "removed $d"
    done ;;
  *) echo "usage: $0 setup [N] | start [codex agy claude] | status | stop | remove"; exit 1 ;;
esac
