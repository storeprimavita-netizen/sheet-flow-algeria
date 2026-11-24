#!/usr/bin/env bash
# One-command quality gate. The gate decides, not the agent that wrote the code.
# tsc → tests (live RLS suite if local Supabase is up) → i18n parity → color lint
# → build → protected paths → secret scan. Prints ≤ ~16 lines so no agent reads
# build/test logs; full output goes to $TMPDIR/mnw-gate-*.log.
# Usage: scripts/gate.sh [--fast]   (--fast skips the build)
set -uo pipefail
cd "$(dirname "$0")/.."
logdir=${TMPDIR:-/tmp}; logdir=${logdir%/}
fail=0
step() { # name, logfile, command...
  local name=$1 log=$2; shift 2
  if "$@" >"$log" 2>&1; then echo "PASS  $name"; else echo "FAIL  $name  (see $log)"; tail -n 6 "$log" | cut -c1-160; fail=1; fi
}

[ -d node_modules ] || { echo "FAIL  node_modules missing — run: npm ci"; echo "GATE FAILED"; exit 1; }

step "tsc" "$logdir/mnw-gate-tsc.log" npx tsc --noEmit

if [ "${GATE_SKIP_LIVE:-}" = "1" ]; then mode="unit only — live suite skipped: parallel worker without database tasks"
elif curl -s -m 2 -o /dev/null http://127.0.0.1:54321/rest/v1/ ; then
  export LOCAL_SUPABASE_URL=http://127.0.0.1:54321; mode="with live RLS suite"
else mode="unit only — local Supabase down, RLS suite SKIPPED"; fi
step "tests ($mode)" "$logdir/mnw-gate-test.log" npx vitest run
grep -E "Tests " "$logdir/mnw-gate-test.log" | sed 's/^ */      /'

step "i18n en/ar parity" "$logdir/mnw-gate-i18n.log" node scripts/check-i18n.mjs

base=$(git merge-base HEAD v3 2>/dev/null || git merge-base HEAD origin/v3 2>/dev/null || echo HEAD)

# color lint: hardcoded colors in ADDED .tsx lines are bugs (AGENTS.md → UI).
# A line containing "gate-allow-color" is skipped (use only with a reason).
colors=$( { git diff "$base" -U0 -- 'src/*.tsx'; git diff -U0 -- 'src/*.tsx'; } | grep -E '^\+[^+]' | grep -v 'gate-allow-color' \
  | grep -Ec '(text|bg|border|ring|fill|stroke)-(white|black)\b|#[0-9a-fA-F]{6}\b|rgba?\(|glass-card|text-gradient' || true)
if [ "$colors" = "0" ]; then echo "PASS  color lint"; else echo "FAIL  color lint: $colors added line(s) with a hardcoded color — use CSS variables"; fail=1; fi

[ "${1:-}" = "--fast" ] || step "build" "$logdir/mnw-gate-build.log" npm run build

# protected paths: a task branch may not edit its own checks or reviewers.
# Loop-maintenance work sets GATE_ALLOW_PROTECTED=1 and says so in the brief.
prot=$(git diff --name-only "$base" | grep -E '^(scripts/(gate|secret-scan|step|push|review-high|gen-types|stage|night|night-workers)\.sh|\.agents/stage-models\.conf|scripts/check-i18n\.mjs|\.claude/settings\.json|\.claude/agents/|\.agents/agents/|\.codex/|vitest\.config\.ts)' || true)
if [ -z "$prot" ] || [ "${GATE_ALLOW_PROTECTED:-}" = "1" ]; then echo "PASS  protected paths"; else echo "FAIL  protected paths changed: $(echo $prot | cut -c1-120)"; fail=1; fi
deleted_tests=$(git diff --name-only --diff-filter=D "$base" | grep -Ec '\.test\.tsx?$' || true)
[ "$deleted_tests" = "0" ] || { echo "FAIL  $deleted_tests test file(s) deleted — needs owner approval"; fail=1; }

scripts/secret-scan.sh "$base" || fail=1

# a full gate that passed on a clean tree leaves the commit id behind, so scripts/night.sh need not run it twice
stamp="${TMPDIR:-/tmp}"; stamp="${stamp%/}/mnw-gate-ok-$(pwd -P | cksum | cut -d' ' -f1)"
if [ $fail = 0 ] && [ "${1:-}" != "--fast" ] && [ -z "$(git status --porcelain)" ]; then git rev-parse HEAD > "$stamp"; elif [ $fail != 0 ]; then rm -f "$stamp"; fi
[ $fail = 0 ] && echo "GATE OK" || echo "GATE FAILED"
exit $fail
