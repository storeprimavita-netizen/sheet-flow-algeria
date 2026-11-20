#!/usr/bin/env bash
# Prepare extra working copies so several Antigravity agents can build at once.
#
#   scripts/agy-parallel.sh setup [N]     create N extra copies (default 2): .worktrees/agy-2, agy-3 …
#   scripts/agy-parallel.sh status        what each copy is doing
#   scripts/agy-parallel.sh remove        delete the extra copies (pushed work is safe on GitHub)
#
# Then open one Terminal window per agent:
#   window 1 (this folder):          scripts/agy-night.sh                 ← the only agent that may change the database
#   window 2:  cd .worktrees/agy-2 && scripts/agy-night.sh agy-2 nodb
#   window 3:  cd .worktrees/agy-3 && scripts/agy-night.sh agy-3 nodb
#
# How they stay out of each other's way:
#   - every agent claims a task in docs/MASTER_PLAN.md on branch v3 and pushes the
#     claim before building; a second agent's push is rejected and it picks another;
#   - extra agents only take tasks WITHOUT a migration (`nodb`), so one agent at a
#     time changes the local database; their gate skips the live database tests,
#     which the main agent runs on every merge;
#   - each copy has its own app port (3001, 3002 …) and its own node_modules.
# The copies are full git clones (a branch cannot be checked out in two worktrees).
# Start with 2 agents; add a third only if the Mac and your usage limit keep up.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
cmd=${1:-status}; n=${2:-2}
url=$(git remote get-url origin)

case "$cmd" in
  setup)
    [ -f .env.local ] || { echo "missing .env.local in the main folder"; exit 1; }
    mkdir -p .worktrees
    for k in $(seq 2 $((n+1))); do
      d=".worktrees/agy-$k"; port=$((3000+k-1))
      if [ -d "$d/.git" ]; then echo "exists  $d"; else
        git clone -q --local --branch v3 "$root" "$d"
        git -C "$d" remote set-url origin "$url"
        echo "cloned  $d"
      fi
      git -C "$d" fetch -q origin v3 && git -C "$d" checkout -q v3 && git -C "$d" reset -q --hard origin/v3
      sed -E "s#^APP_URL=.*#APP_URL=http://localhost:$port#" .env.local > "$d/.env.local"
      grep -q '^APP_PORT=' "$d/.env.local" || echo "APP_PORT=$port" >> "$d/.env.local"
      [ -d "$d/node_modules" ] || { echo "installing packages in $d (about a minute)"; (cd "$d" && npm ci --silent >/dev/null 2>&1) || { echo "npm ci failed in $d"; exit 1; }; }
      echo "ready   $d   port $port   →   cd $d && APP_PORT=$port agy     then type:  /loop-night nodb as:agy-$k"
    done ;;
  status)
    for d in "$root" "$root"/.worktrees/agy-*; do
      [ -d "$d/.git" ] || continue
      printf '%-34s %-16s %s\n' "$(basename "$d")" "$(git -C "$d" branch --show-current)" "$(git -C "$d" log -1 --format='%cd %s' --date=format:'%H:%M' | cut -c1-70)"
    done
    echo "--- claimed now"; git show origin/v3:docs/MASTER_PLAN.md 2>/dev/null | awk -F'|' 'NF>4 && $(NF-1) ~ /claimed:/ {print $2 "|" $(NF-1)}' ;;
  remove)
    for d in .worktrees/agy-*; do
      [ -d "$d/.git" ] || continue
      if [ -n "$(git -C "$d" status --porcelain)" ] || [ -n "$(git -C "$d" log --branches --not --remotes --oneline | head -1)" ]; then
        echo "KEPT    $d has uncommitted or unpushed work — look at it first"; continue
      fi
      rm -rf "$d"; echo "removed $d"
    done ;;
  *) echo "usage: $0 setup [N] | status | remove"; exit 1 ;;
esac
