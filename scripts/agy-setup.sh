#!/usr/bin/env bash
# One-time Antigravity CLI setup check for this project. Changes nothing unless
# you pass --write-permissions.
#
#   scripts/agy-setup.sh                      check: agy installed, signed in, models, skills visible
#   scripts/agy-setup.sh --write-permissions  also create ~/.gemini/antigravity-cli/settings.json
#                                             the allow/deny rules below are added to it (the file is
#                                             backed up first; its other settings are kept)
#
# Rule syntax is from antigravity.google/docs/permissions (read 2026-11-17) and
# was NOT tested here — if agy rejects the file, restore the backup and set the
# rules from the app's settings instead.
set -uo pipefail
cd "$(dirname "$0")/.."
cfg="$HOME/.gemini/antigravity-cli/settings.json"

if ! command -v agy >/dev/null 2>&1; then
  echo "agy: NOT INSTALLED"
  echo "  install:  curl -fsSL https://antigravity.google/cli/install.sh | bash"
  echo "  then open a new Terminal window, run \`agy\` once and sign in with your Google AI Pro account."
  exit 1
fi
echo "agy: $(agy --version 2>&1 | head -1)"
echo "--- models your account can use (pick one for AGY_MODEL)"
agy models 2>&1 | head -30
echo "--- project files agy reads"
for f in AGENTS.md .agents/rules/antigravity.md .agents/mcp_config.json; do [ -f "$f" ] && echo "ok   $f" || echo "MISSING $f"; done
echo "skills:  $(ls .agents/skills | tr '\n' ' ')"
echo "agents:  $(ls .agents/agents | tr '\n' ' ')"
for s in .agents/skills/*; do [ -f "$s/SKILL.md" ] || echo "BROKEN skill link: $s (run scripts/sync-agent-skills.sh --copy)"; done
echo "--- permissions file: $cfg"
[ -f "$cfg" ] && echo "exists" || echo "not there yet"

if [ "${1:-}" = "--write-permissions" ]; then
  mkdir -p "$(dirname "$cfg")"
  [ -f "$cfg" ] && cp "$cfg" "$cfg.backup-$(date +%Y%m%d-%H%M%S)" && echo "backed up the existing file"
  rules=$(cat <<'JSON'
{
  "permissions": {
    "allow": [
      "command(git)",
      "command(git push)",
      "command(regex:scripts/(gate|step|secret-scan|dev-up|dev-down|db-reset|notify)\\.sh.*)",
      "command(regex:npx (tsc|vitest|supabase (status|migration|gen|db reset --local)).*)",
      "command(regex:npm (ci|test|run build).*)",
      "command(regex:node (--import|--env-file|scripts/).*)",
      "command(regex:(ls|cat|head|tail|sed|grep|rg|find|wc|sort|uniq|cut|awk|curl -s -m [0-9]+ .*(127\\.0\\.0\\.1|localhost)).*)"
    ],
    "deny": [
      "write_file(.git/)",
      "command(regex:git push.*(--force|-f( |$)).*)",
      "command(regex:git push.* main.*)",
      "command(regex:git reset --hard.*)",
      "command(regex:.*supabase (db push|link|db reset --linked).*)",
      "command(regex:.*(rm -rf /|sudo ).*)"
    ],
    "ask": ["command(*)"]
  }
}
JSON
)
  # merge: keep everything already in the file (trusted folders, model choice …), replace only "permissions"
  RULES="$rules" python3 - "$cfg" <<'PY' || { echo "could not write $cfg — nothing changed"; exit 1; }
import json, os, sys
path = sys.argv[1]
try:
    with open(path) as f: cur = json.load(f)
except FileNotFoundError:
    cur = {}
cur["permissions"] = json.loads(os.environ["RULES"])["permissions"]
with open(path, "w") as f: json.dump(cur, f, indent=2); f.write("\n")
PY
  echo "written. Deny beats ask beats allow. Check it loaded: run \`agy\`, try \`/loop-bootstrap\`."
fi
