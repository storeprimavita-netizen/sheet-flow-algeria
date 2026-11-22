#!/usr/bin/env bash
# Bring the local stack up and say what is running. Safe to call repeatedly.
# Docker (colima) → local Supabase → Next dev server on :3000.
# Usage: scripts/dev-up.sh [--no-app]     (--no-app: database only, for the gate)
# When another program already holds :3000 (another project, a Docker container),
# the app starts on the next free port instead. ALWAYS use the address printed on
# the "UP app" line; the port is also kept in the file .dev-port.
# Local only: never touches the remote Supabase project.
set -uo pipefail
cd "$(dirname "$0")/.."
logdir=${TMPDIR:-/tmp}; logdir=${logdir%/}
. scripts/dev-lib.sh
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
  if [ -n "${APP_PORT:-}" ]; then      # parallel workers set APP_PORT=3001, 3002…
    port=$APP_PORT
    if [ -n "$(listener "$port")" ] && ! mine "$port"; then echo "DOWN  app — port $port is used by another program ($(who "$port")); pick another APP_PORT"; exit 1; fi
  else
    port=$(pick_port) || { echo "DOWN  app — ports 3000-3009 are all used by other programs"; exit 1; }
  fi
  # the app is up only when THIS folder's server answers — another program on the port does not count
  app() { mine "$port" && curl -sf -m 5 -o /dev/null "http://localhost:$port/login"; }
  if ! app; then
    # a build cache that grew past ~4 GB makes the dev server spin all cores; it is safe to delete
    if [ -d .next ] && [ "$(du -sk .next 2>/dev/null | cut -f1)" -gt 4000000 ]; then rm -rf .next; echo "CLEAN build cache (.next was over 4 GB)"; fi
    mine "$port" || nohup npm run dev -- -p "$port" >"$logdir/mnw-dev-$port.log" 2>&1 &
    for _ in $(seq 1 30); do sleep 2; app && break; done
  fi
  echo "$port" > .dev-port
  pgrep -f "scripts/dev-watchdog.sh $port" >/dev/null 2>&1 || (nohup scripts/dev-watchdog.sh "$port" >/dev/null 2>&1 &)
  app && echo "UP    app       http://localhost:$port  (admin@seed.mnw — docs/TESTING.md)" || { echo "DOWN  app — see $logdir/mnw-dev-$port.log"; ok=1; }
  if [ "$port" != 3000 ] && [ -z "${APP_PORT:-}" ] && [ -n "$(listener 3000)" ]; then echo "NOTE  port 3000 is used by another program ($(who 3000)) — the MNW app is on port $port, use the address above"; fi
fi
exit $ok
