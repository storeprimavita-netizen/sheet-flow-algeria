#!/usr/bin/env bash
# Secret scan of added lines (branch diff vs base + working tree + staged).
# Prints file-free counts only, never values. Exit 1 on a hit.
# Usage: scripts/secret-scan.sh [base-ref]   (default: merge-base with v3)
set -uo pipefail
cd "$(dirname "$0")/.."
base=${1:-$(git merge-base HEAD v3 2>/dev/null || git merge-base HEAD origin/v3 2>/dev/null || echo HEAD)}
pattern='(sk-[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{30,}|xox[bp]-[A-Za-z0-9-]{20,}|EAA[A-Za-z0-9]{40,}|[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)'
hits=$( { git diff "$base" -U0; git diff -U0; git diff --cached -U0; } | grep -E '^\+' | grep -Ec "$pattern" || true)
fail=0
if [ "$hits" != "0" ]; then echo "FAIL  secret scan: $hits suspicious added line(s) — inspect manually, never paste values"; fail=1; fi
# untracked files are invisible to git diff — scan them too (names only)
while IFS= read -r f; do
  [ -f "$f" ] && grep -Eq "$pattern" "$f" 2>/dev/null && { echo "FAIL  secret scan: untracked file $f"; fail=1; }
done < <(git ls-files --others --exclude-standard)
if git ls-files | grep -Eq '(^|/)(\.env($|\.)|kimi)'; then echo "FAIL  tracked env/kimi file"; fail=1; fi
[ $fail = 0 ] && echo "PASS  secret scan"
exit $fail
