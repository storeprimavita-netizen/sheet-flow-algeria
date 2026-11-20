#!/usr/bin/env bash
# Stop the app's dev server (and, with --all, the local Supabase + Docker VM) so
# the Mac can cool down. Nothing is lost: the database keeps its data.
#   scripts/dev-down.sh          stop the dev server on this folder's port
#   scripts/dev-down.sh --all    also stop Supabase and the Docker VM (colima)
# Start again with scripts/dev-up.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
port=${APP_PORT:-3000}
pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then kill $pids 2>/dev/null; sleep 2; kill -9 $pids 2>/dev/null || true; echo "stopped  dev server on :$port"; else echo "no dev server on :$port"; fi
pkill -f "$(pwd)/node_modules/.bin/next dev" 2>/dev/null || true
if [ "${1:-}" = "--all" ]; then
  npx supabase stop >/dev/null 2>&1 && echo "stopped  supabase"
  command -v colima >/dev/null 2>&1 && colima stop >/dev/null 2>&1 && echo "stopped  docker (colima)"
fi
