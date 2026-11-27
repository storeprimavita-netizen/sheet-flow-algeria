#!/usr/bin/env bash
# Stop the app's dev server (and, with --all, the local Supabase + Docker VM) so
# the Mac can cool down. Nothing is lost: the database keeps its data.
#   scripts/dev-down.sh          stop the dev server on this folder's port
#   scripts/dev-down.sh --all    also stop Supabase and the Docker VM (colima)
# Start again with scripts/dev-up.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/dev-lib.sh
port=${APP_PORT:-$(saved_port || echo 3000)}
# stop only THIS folder's server: another project or a Docker container on the port is left alone
if mine "$port"; then
  pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  kill $pids 2>/dev/null; sleep 2; kill -9 $pids 2>/dev/null || true; echo "stopped  dev server on :$port"
elif [ -n "$(listener "$port")" ]; then echo "no dev server of this folder on :$port (the port belongs to $(who "$port") — left alone)"
else echo "no dev server on :$port"; fi
[ -n "${APP_PORT:-}" ] || rm -f .dev-port
pkill -f "$(pwd)/node_modules/.bin/next dev" 2>/dev/null || true
pkill -f "$dev_root/scripts/dev-watchdog.sh $port" 2>/dev/null || true    # this folder's watchdog only (started with its full path)
if [ "${1:-}" = "--all" ]; then
  npx supabase stop >/dev/null 2>&1 && echo "stopped  supabase"
  command -v colima >/dev/null 2>&1 && colima stop >/dev/null 2>&1 && echo "stopped  docker (colima)"
fi
