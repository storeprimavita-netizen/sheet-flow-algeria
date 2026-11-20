#!/usr/bin/env bash
# Guards the dev server started by scripts/dev-up.sh, whoever started it
# (Claude Code, Antigravity, a script, or you) and however that session ended.
# Checks once a minute and stops the server when:
#   - it has used more than 3 cores for 5 minutes with nobody connected
#     (runaway rebuild) → stop it and delete the build cache;
#   - nobody has connected for 45 minutes (forgotten after a run) → stop it;
#   - the build cache has grown past 4 GB → stop it and delete the cache.
# The next scripts/dev-up.sh starts a clean one. Log: $TMPDIR/mnw-dev-watchdog-<port>.log
set -uo pipefail
cd "$(dirname "$0")/.."
port=${1:-3000}
log="${TMPDIR:-/tmp}"; log="${log%/}/mnw-dev-watchdog-$port.log"
say() { echo "$(date '+%F %H:%M') $*" >> "$log"; }
stop() { # reason, clear-cache?
  local pids; pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && { kill $pids 2>/dev/null; sleep 3; kill -9 $pids 2>/dev/null || true; }
  [ "${2:-}" = "clear" ] && rm -rf .next
  say "STOPPED dev server on :$port — $1"
  exit 0
}
hot=0; idle=0; tick=0
say "watching :$port"
while :; do
  sleep 60; tick=$((tick+1))
  pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  [ -n "$pid" ] || { say "server gone — watchdog exits"; exit 0; }
  cpu=$(ps -o %cpu= -p "$pid" 2>/dev/null | awk '{printf "%d", $1}'); cpu=${cpu:-0}
  conns=$(lsof -nP -iTCP:"$port" 2>/dev/null | grep -c ESTABLISHED || true)
  if [ "$conns" -eq 0 ]; then idle=$((idle+1)); else idle=0; fi
  if [ "$cpu" -gt 300 ] && [ "$conns" -eq 0 ]; then hot=$((hot+1)); else hot=0; fi
  [ "$hot" -ge 5 ] && stop "over 3 cores for 5 minutes with nobody connected (${cpu}% CPU)" clear
  [ "$idle" -ge 45 ] && stop "nobody connected for 45 minutes"
  if [ $((tick % 10)) -eq 0 ] && [ -d .next ] && [ "$(du -sk .next 2>/dev/null | cut -f1)" -gt 4000000 ]; then
    stop "build cache over 4 GB" clear
  fi
done
