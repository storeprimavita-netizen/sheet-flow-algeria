#!/usr/bin/env bash
# Several agents building at the same time, each in its own copy of the project.
#
#   scripts/night-workers.sh setup [N]          create N extra copies (default 1): .worktrees/w2, w3 …
#   scripts/night-workers.sh start [N] [cli]    start the main run + N extra runs (default: every copy that exists)
#                                               in one tmux session; `cli` = program the extra runs try first
#                                               (agy | codex | claude — another account means another usage limit)
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
# Two agents on the SAME account share one usage limit: they finish sooner, they do not do more.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
cmd=${1:-status}; session=mnw
copies() { ls -d "$root"/.worktrees/w[0-9]* 2>/dev/null || true; }

case "$cmd" in
  setup)
    n=${2:-1}; url=$(git remote get-url origin)
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
    tmux has-session -t "$session" 2>/dev/null && { echo "already running — look: tmux attach -t $session   stop: scripts/night-workers.sh stop"; exit 1; }
    n=${2:-}; prefer=${3:-}
    case "$n" in agy|codex|claude) prefer=$n; n="" ;; esac
    tmux new-session -d -s "$session" -n main -c "$root" "scripts/night.sh; echo; echo '[main run ended — press Enter to close]'; read -r _"
    echo "started main        (all tasks, database tasks included)"
    i=0
    for d in $(copies); do
      i=$((i+1)); [ -n "$n" ] && [ "$i" -gt "$n" ] && break
      w=$(basename "$d")
      tmux new-window -d -t "$session" -n "$w" -c "$d" "${prefer:+STAGE_PREFER=$prefer }scripts/night.sh $w nodb; echo; echo '[$w ended — press Enter to close]'; read -r _"
      echo "started $w          (tasks without a migration${prefer:+, tries $prefer first})"
    done
    [ "$i" = 0 ] && echo "no extra copies — create one with: scripts/night-workers.sh setup"
    echo "watch:  tmux attach -t $session      (Ctrl+B then 0/1/2 switches run · Ctrl+B then D leaves them running)" ;;
  status)
    tmux has-session -t "$session" 2>/dev/null && tmux list-windows -t "$session" -F 'running  #{window_name}' || echo "no run started by this script"
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
  *) echo "usage: $0 setup [N] | start [N] [agy|codex|claude] | status | stop | remove"; exit 1 ;;
esac
