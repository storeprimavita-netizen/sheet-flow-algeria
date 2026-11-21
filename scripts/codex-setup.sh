#!/usr/bin/env bash
# Check that this Mac and this project are ready for OpenAI Codex — the desktop
# app (ChatGPT app → Codex) or the CLI (D96). Run it again after any edit under .codex/.
#
#   scripts/codex-setup.sh            check only, changes nothing
#   scripts/codex-setup.sh --trust    also mark this folder as trusted in ~/.codex/config.toml
#                                     (without trust Codex ignores .codex/: settings, rules, reviewers, hooks)
set -uo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)
ok=0; warn=0; bad=0
pass() { echo "OK    $*"; ok=$((ok+1)); }
note() { echo "NOTE  $*"; warn=$((warn+1)); }
fail() { echo "FAIL  $*"; bad=$((bad+1)); }
home="${CODEX_HOME:-$HOME/.codex}"
app_cli="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"
if command -v codex >/dev/null 2>&1; then cx=codex; elif [ -x "$app_cli" ]; then cx="$app_cli"; else cx=""; fi
trusted() { python3 -I - "$home/config.toml" "$root" <<'PY'
import sys, tomllib
try:
    d = tomllib.load(open(sys.argv[1], "rb"))
except Exception:
    sys.exit(1)
sys.exit(0 if d.get("projects", {}).get(sys.argv[2], {}).get("trust_level") == "trusted" else 1)
PY
}

if [ "${1:-}" = "--trust" ]; then
  if trusted; then echo "already trusted: $root"
  else
    mkdir -p "$home"; [ -f "$home/config.toml" ] && cp "$home/config.toml" "$home/config.toml.before-mnw-trust"
    printf '\n[projects."%s"]\ntrust_level = "trusted"\n' "$root" >> "$home/config.toml"
    trusted && echo "TRUSTED  $root  (added to $home/config.toml; quit and reopen the app so it reads it)" \
            || { echo "could not add trust — the file did not parse afterwards; restoring"; cp "$home/config.toml.before-mnw-trust" "$home/config.toml"; exit 1; }
  fi
  echo
fi

# --- project files -------------------------------------------------------------------
for f in AGENTS.md .codex/config.toml .codex/rules/mnw.rules .codex/hooks.json .codex/guard.py .codex/night-stop.py \
         .codex/agents/qa-reviewer.toml .codex/agents/ui-reviewer.toml .codex/agents/stage-runner.toml .codex/agents/decider.toml \
         .agents/skills/loop-night/SKILL.md .agents/skills/loop-auto/SKILL.md \
         scripts/step.sh scripts/push.sh scripts/gate.sh scripts/gen-types.sh scripts/review-high.sh; do
  [ -e "$f" ] || fail "missing $f"
done
python3 -I - <<'PY' && pass "settings and agent files parse" || fail "a file under .codex/ does not parse (see above)"
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
g() { printf '%s' "$1" | python3 -I -c 'import json,sys;print(json.dumps({"tool_input":{"command":sys.stdin.read()}}))' | python3 -I .codex/guard.py 2>/dev/null; echo $?; }
if [ "$(g 'git push origin main')" = 2 ] && [ "$(g 'npx supabase db push')" = 2 ] && [ "$(g 'scripts/step.sh "X-1: claim"')" = 0 ] && [ "$(g 'git status -sb')" = 0 ]; then
  pass "command guard blocks what it should and lets normal work through"
else fail "command guard (.codex/guard.py) gives wrong answers"; fi
[ -e .night-run ] && note "a night-run flag (.night-run) exists — a night run is on, or one ended badly; delete the file if none is running"
[ "$(git branch --show-current)" = "v3" ] && pass "on branch v3" || note "current branch is $(git branch --show-current) — the night run switches to v3 itself"
[ -d node_modules ] && pass "node_modules present" || fail "node_modules missing — run: npm ci"
curl -s -m 2 -o /dev/null http://127.0.0.1:54321/rest/v1/ && pass "local Supabase is up" || note "local Supabase is down — the night run starts it (scripts/dev-up.sh); Docker must be running"
command -v claude >/dev/null 2>&1 && pass "claude found — high-risk reviews go to Claude Opus first" || note "claude not found — high-risk reviews will use Codex's own qa-reviewer"

# --- Codex itself -----------------------------------------------------------------------
if [ -z "$cx" ]; then
  fail "Codex not found — install the ChatGPT desktop app (it contains Codex), or: npm install -g @openai/codex"
else
  pass "Codex program: $("$cx" --version 2>/dev/null | head -1)$([ "$cx" = codex ] || echo ' (inside the ChatGPT app)')"
  "$cx" login status >/dev/null 2>&1 && pass "signed in" || note "not signed in for the command line — sign in inside the app (enough for the app)"
  # rules: "expected decision | command", answered by the real rule engine
  rules_ok=1; n=0
  while IFS='|' read -r want cmd; do
    [ -n "$want" ] || continue
    want=$(echo "$want" | tr -d ' '); n=$((n+1))
    # shellcheck disable=SC2086
    got=$("$cx" execpolicy check --rules .codex/rules/mnw.rules -- $cmd 2>&1 | grep -o '"decision":"[a-z]*"' | tail -1 | cut -d'"' -f4)
    [ "${got:-none}" = "$want" ] || { echo "      expected $want, got ${got:-none}: $cmd"; rules_ok=0; }
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
allow     | scripts/gen-types.sh
allow     | scripts/review-high.sh X-1
allow     | git checkout v3
allow     | git pull --rebase
allow     | git merge --no-ff v3-X-1
none      | git status -sb
none      | npx vitest run
CASES
  [ "$rules_ok" = 1 ] && pass "command rules answer as intended ($n sample commands, real rule engine)" \
                      || fail "command rules (.codex/rules/mnw.rules) do not answer as intended — see lines above; do not start a night run"
  # every model named under .codex/ must exist in the account's model list
  missing=$("$cx" debug models 2>/dev/null | python3 -I -c '
import json, sys, glob, tomllib
try:
    d = json.load(sys.stdin); have = {m.get("slug") for m in (d.get("models", []) if isinstance(d, dict) else d)}
except Exception: print("?"); sys.exit()
want = {}
for f in [".codex/config.toml"] + sorted(glob.glob(".codex/agents/*.toml")):
    m = tomllib.load(open(f, "rb")).get("model")
    if m: want[f] = m
print(" ".join("%s(%s)" % (m, f.split("/")[-1]) for f, m in want.items() if m not in have))')
  case "$missing" in
    "")  pass "the models named in .codex/ are all in the account's model list" ;;
    "?") note "could not read the model list (codex debug models) — models not checked" ;;
    *)   fail "model not offered to this account: $missing — change it in that file (list: $cx debug models)" ;;
  esac
  # does Codex really load this project's settings and skills? (renders what the model would see; calls no model)
  if trusted; then
    seen=$("$cx" debug prompt-input "check" 2>/dev/null)
    grep -q "MNW-CODEX-SETTINGS-LOADED" <<<"$seen" && pass "Codex loads this project's settings (.codex/config.toml)" || fail "folder is trusted but Codex does not load .codex/config.toml — run: $cx debug prompt-input check"
    grep -q "loop-night" <<<"$seen" && pass "Codex sees the skills (loop-night and the others)" || fail "Codex does not list the loop-night skill"
    grep -q "stage-runner" <<<"$seen" && grep -q "decider" <<<"$seen" && pass "Codex sees the project agents (stage-runner, decider, qa-reviewer, ui-reviewer)" || note "the project agents are not named in the prompt — check in the app that stage-runner can be started"
  else
    fail "this folder is not trusted by Codex, so it ignores .codex/ (rules off) — run: scripts/codex-setup.sh --trust   then quit and reopen the app"
  fi
fi

echo
echo "$ok ok · $warn notes · $bad failed"
if [ "$bad" = 0 ]; then
  echo "READY. In the app: new chat in this project (not \"New worktree\"), permissions \"Approve for me\","
  echo "       trust the two project hooks when asked (Review hooks), then type:  \$loop-night"
else echo "NOT READY — fix the FAIL lines, then run this again."; fi
[ "$bad" = 0 ]
