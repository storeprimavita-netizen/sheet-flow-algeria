#!/usr/bin/env bash
# Rebuild the LOCAL database from the migrations on the current branch and
# reload the seed data. Use before building a task that has a migration and
# after leaving a branch whose migration was not merged — otherwise the local
# database keeps tables/functions from another branch and tests lie.
# Local only: refuses if .env.local does not point at 127.0.0.1/localhost.
set -uo pipefail
cd "$(dirname "$0")/.."
logdir=${TMPDIR:-/tmp}; logdir=${logdir%/}
grep -Eq '^NEXT_PUBLIC_SUPABASE_URL=https?://(127\.0\.0\.1|localhost)' .env.local 2>/dev/null \
  || { echo "REFUSED  .env.local is missing or does not point at the local stack"; exit 1; }
npx supabase db reset --local >"$logdir/mnw-db-reset.log" 2>&1 \
  || { echo "FAILED  db reset (see $logdir/mnw-db-reset.log)"; tail -n 5 "$logdir/mnw-db-reset.log" | cut -c1-160; exit 1; }
url=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
akey=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"')
for _ in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $akey" "$url/rest/v1/")" = 200 ] && break
  sleep 1
done
node --import ./scripts/seed-register.mjs --env-file=.env.local scripts/seed-dev.ts >"$logdir/mnw-db-seed.log" 2>&1 \
  || { echo "FAILED  seed (see $logdir/mnw-db-seed.log)"; tail -n 5 "$logdir/mnw-db-seed.log" | cut -c1-160; exit 1; }
echo "OK    local database reset to $(ls supabase/migrations | tail -1) and seeded"
