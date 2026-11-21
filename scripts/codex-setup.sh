#!/usr/bin/env bash
# Check that this Mac and this project are ready for OpenAI Codex CLI (D96).
# Changes nothing. Run it after installing Codex and again after any edit under .codex/.
# Usage: scripts/codex-setup.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ok=0; warn=0; bad=0
pass() { echo "OK    $*"; ok=$((ok+1)); }
note() { echo "NOTE  $*"; warn=$((warn+1)); }
fail() { echo "FAIL  $*"; bad=$((bad+1)); }

# --- project files (no Codex needed) ---------------------------------------------
for f in AGENTS.md .codex/config.toml .codex/rules/mnw.rules .codex/hooks.json .codex/guard.py \
         .codex/agents/qa-reviewer.toml .codex/agents/ui-reviewer.toml \
         scripts/step.sh scripts/push.sh scripts/gate.sh scripts/review-high.sh scripts/codex-night.sh; do
  [ -e "$f" ] || fail "missing $f"
done
python3 -I - <<'PY' && pass "settings and reviewer files are valid TOML / JSON" || fail "a file under .codex/ does not parse (see above)"
import json, sys, tomllib, glob
try:
    for f in [".codex/config.toml"] + glob.glob(".codex/agents/*.toml"):
        d = tomllib.load(open(f, "rb"))
        if "agents/" in f:
            for k in ("name", "description", "developer_instructions"):
                assert k in d, f + " lacks " + k
    json.load(open(".codex/hooks.json"))
except Exception as e:
    print("      " + str(e)); sys.exit(1)
PY
size=$(wc -c < AGENTS.md | tr -d ' ')
[ "$size" -lt 32768 ] && pass "AGENTS.md is $size bytes (Codex reads up to 32768)" || fail "AGENTS.md is $size bytes — Codex cuts it at 32768"
n=0; brokenskill=""
for d in .agents/skills/*/; do n=$((n+1)); [ -f "$d/SKILL.md" ] || brokenskill="$brokenskill $d"; done
[ -z "$brokenskill" ] && pass "$n skills in .agents/skills (Codex reads them from there)" || fail "skill folder without SKILL.md:$brokenskill"
g() { printf '%s' "$1" | python3 -I -c 'import json,sys;print(json.dumps({"tool_input":{"command":sys.stdin.read()}}))' | python3 -I .codex/guard.py 2>/dev/null; echo $?; }
if [ "$(g 'git push origin main')" = 2 ] && [ "$(g 'npx supabase db push')" = 2 ] && [ "$(g 'scripts/step.sh "X-1: claim"')" = 0 ] && [ "$(g 'git status -sb')" = 0 ]; then
  pass "command guard blocks what it should and lets normal work through"
else fail "command guard (.codex/guard.py) gives wrong answers"; fi
[ -d node_modules ] && pass "node_modules present" || fail "node_modules missing — run: npm ci"
curl -s -m 2 -o /dev/null http://127.0.0.1:54321/rest/v1/ && pass "local Supabase is up" || note "local Supabase is down — database tests will be skipped (start it: npx supabase start)"
command -v claude >/dev/null 2>&1 && pass "claude found — high-risk reviews go to Claude Opus first" || note "claude not found — high-risk reviews will use Codex's own qa-reviewer"

# --- Codex itself -------------------------------------------------------------------
if ! command -v codex >/dev/null 2>&1; then
  fail "codex is not installed — run:  npm install -g @openai/codex"
else
  pass "codex $(codex --version 2>/dev/null | head -1)"
  codex login status >/dev/null 2>&1 && pass "signed in" || fail "not signed in — run: codex login"
  if grep -Fq "$(pwd)" "${CODEX_HOME:-$HOME/.codex}/config.toml" 2>/dev/null; then pass "this folder is known to Codex (trust is recorded in ~/.codex/config.toml)"
  else note "this folder is not trusted yet — start \`codex\` here once and accept; until then .codex/ is ignored"; fi
  # rules: every line is "expected decision | command"
  rules_ok=1; rules_seen=0
  while IFS='|' read -r want cmd; do
    [ -n "$want" ] || continue
    want=$(echo "$want" | tr -d ' ')
    # shellcheck disable=SC2086
    got=$(codex execpolicy check --rules .codex/rules/mnw.rules -- $cmd 2>&1)
    rules_seen=1
    case "$want" in
      none) echo "$got" | grep -Eqi '"decision" *: *"(allow|forbidden|prompt)"' && { echo "      rule matched but none expected: $cmd"; rules_ok=0; } ;;
      *)    echo "$got" | grep -qi "\"$want\"" || { echo "      expected $want: $cmd  → $(echo "$got" | tr '\n' ' ' | cut -c1-140)"; rules_ok=0; } ;;
    esac
  done <<'CASES'
forbidden | git push origin main
forbidden | git push --force origin v3
forbidden | git commit -m x
forbidden | git reset --hard HEAD~1
forbidden | git checkout main
forbidden | npx supabase db push
forbidden | supabase link
forbidden | npm run dev
allow     | scripts/step.sh X-1:claim
allow     | scripts/push.sh
allow     | scripts/gate.sh --fast
allow     | git checkout v3
allow     | git pull --rebase
allow     | git merge --no-ff v3-X-1
none      | git status -sb
none      | npx vitest run
CASES
  if [ "$rules_seen" = 1 ] && [ "$rules_ok" = 1 ]; then pass "command rules answer as intended (16 sample commands)"
  else fail "command rules (.codex/rules/mnw.rules) do not answer as intended — see lines above; do not start a night run"; fi
fi

echo
echo "$ok ok · $warn notes · $bad failed"
[ "$bad" = 0 ] && echo "READY — next: start \`codex\` here, type /hooks and trust the project guard, then try one task:  \$loop-auto" || echo "NOT READY — fix the FAIL lines, then run this again."
exit $([ "$bad" = 0 ] && echo 0 || echo 1)
