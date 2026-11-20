#!/usr/bin/env bash
# Bring the local stack up and say what is running. Safe to call repeatedly.
# Docker (colima) → local Supabase → Next dev server on :3000.
# Usage: scripts/dev-up.sh [--no-app]     (--no-app: database only, for the gate)
# Local only: never touches the remote Supabase project.
set -uo pipefail
cd "$(dirname "$0")/.."
logdir=${TMPDIR:-/tmp}; logdir=${logdir%/}
port=${APP_PORT:-3000}      # parallel workers set APP_PORT=3001, 3002…
ok=0

if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then colima start >"$logdir/mnw-colima.log" 2>&1; fi
fi
docker info >/dev/null 2>&1 && echo "UP    docker" || { echo "DOWN  docker (start Docker/colima) — see $logdir/mnw-colima.log"; ok=1; }

api() { curl -s -m 3 -o /dev/null http://127.0.0.1:54321/rest/v1/; }
if [ $ok = 0 ] && ! api; then npx supabase start >"$logdir/mnw-supabase.log" 2>&1; fi
api && echo "UP    supabase  http://127.0.0.1:54321" || { echo "DOWN  supabase — see $logdir/mnw-supabase.log"; ok=1; }

[ -f .env.local ] && echo "OK    .env.local" || { echo "MISSING .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL)"; ok=1; }

if [ "${1:-}" != "--no-app" ] && [ $ok = 0 ]; then
  app() { curl -s -m 5 -o /dev/null "http://localhost:$port/login"; }
  if ! app; then
    # a build cache that grew past ~4 GB makes the dev server spin all cores; it is safe to delete
    if [ -d .next ] && [ "$(du -sk .next 2>/dev/null | cut -f1)" -gt 4000000 ]; then rm -rf .next; echo "CLEAN build cache (.next was over 4 GB)"; fi
    nohup npm run dev -- -p "$port" >"$logdir/mnw-dev-$port.log" 2>&1 &
    for _ in $(seq 1 30); do sleep 2; app && break; done
  fi
  pgrep -f "scripts/dev-watchdog.sh $port" >/dev/null 2>&1 || (nohup scripts/dev-watchdog.sh "$port" >/dev/null 2>&1 &)
  app && echo "UP    app       http://localhost:$port  (admin@seed.mnw — docs/TESTING.md)" || { echo "DOWN  app — see $logdir/mnw-dev-$port.log"; ok=1; }
fi
exit $ok
