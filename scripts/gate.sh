#!/usr/bin/env bash
# One-command quality gate: tsc → tests (live RLS suite if local Supabase is up)
# → build → secret scan of the branch diff. Prints ≤ ~12 lines so the model
# never reads build/test logs; full output goes to /tmp/mnw-gate-*.log.
# Usage: scripts/gate.sh [--fast]   (--fast skips the build)
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
step() { # name, logfile, command...
  local name=$1 log=$2; shift 2
  if "$@" >"$log" 2>&1; then echo "PASS  $name"; else echo "FAIL  $name  (see $log)"; tail -n 6 "$log" | cut -c1-160; fail=1; fi
}

step "tsc" /tmp/mnw-gate-tsc.log npx tsc --noEmit

if curl -s -m 2 -o /dev/null http://127.0.0.1:54321/rest/v1/ ; then
  export LOCAL_SUPABASE_URL=http://127.0.0.1:54321; mode="with live RLS suite"
else mode="unit only — local Supabase down, RLS suite SKIPPED"; fi
step "tests ($mode)" /tmp/mnw-gate-test.log npx vitest run
grep -E "Tests " /tmp/mnw-gate-test.log | sed 's/^ */      /'

[ "${1:-}" = "--fast" ] || step "build" /tmp/mnw-gate-build.log npm run build

# secret scan: added lines vs the merge base, redacted (prints file + count only)
base=$(git merge-base HEAD mnw 2>/dev/null || echo HEAD~1)
hits=$( { git diff "$base" -U0; git diff -U0; } | grep -E '^\+' \
  | grep -Ec '(sk-[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,}|xox[bp]-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' || true)
if [ "$hits" = "0" ]; then echo "PASS  secret scan"; else echo "FAIL  secret scan: $hits suspicious added line(s) — inspect manually, never paste values"; fail=1; fi
git ls-files | grep -Eq '(^|/)(\.env($|\.)|kimi)' && { echo "FAIL  tracked env/kimi file"; fail=1; }

[ $fail = 0 ] && echo "GATE OK" || echo "GATE FAILED"
exit $fail
