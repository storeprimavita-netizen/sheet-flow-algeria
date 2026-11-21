#!/usr/bin/env bash
# Regenerate src/lib/supabase/database.types.ts from the LOCAL database (never
# the linked project). Run after a migration, once scripts/db-reset.sh has
# applied it. Keeps the old file when the generator prints nothing.
# Usage: scripts/gen-types.sh
set -uo pipefail
cd "$(dirname "$0")/.."
out=src/lib/supabase/database.types.ts
logdir=${TMPDIR:-/tmp}; logdir=${logdir%/}
curl -s -m 3 -o /dev/null http://127.0.0.1:54321/rest/v1/ || { echo "FAILED  local Supabase is down — scripts/dev-up.sh first"; exit 1; }
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
npx supabase gen types typescript --local >"$tmp" 2>"$logdir/mnw-gen-types.log" \
  || { echo "FAILED  gen types (see $logdir/mnw-gen-types.log)"; tail -n 4 "$logdir/mnw-gen-types.log" | cut -c1-160; exit 1; }
grep -q "export type Database" "$tmp" || { echo "FAILED  generator printed no types — $out left as it was (see $logdir/mnw-gen-types.log)"; exit 1; }
if cmp -s "$tmp" "$out"; then echo "OK    types already up to date"; else cp "$tmp" "$out"; echo "OK    $out regenerated from the local database ($(wc -l < "$out" | tr -d ' ') lines)"; fi
