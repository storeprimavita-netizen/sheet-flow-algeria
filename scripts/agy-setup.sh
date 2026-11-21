#!/usr/bin/env bash
# One-time Antigravity CLI setup check for this project. Changes nothing unless
# you pass --write-permissions.
#
#   scripts/agy-setup.sh                      check: agy installed, signed in, models, skills visible
#   scripts/agy-setup.sh --write-permissions  also create ~/.gemini/antigravity-cli/settings.json
#                                             the allow/deny rules below are added to it (the file is
#                                             backed up first; its other settings are kept)
#
# Rule syntax is from antigravity.google/docs/permissions (re-read 2026-11-21):
#   - a rule is a word-by-word PREFIX of the command (`command(git)` covers every git command);
#   - deny beats ask beats allow, so there is no catch-all "ask" rule here (it would
#     override every allow); anything not listed asks, or is refused in a headless run;
#   - `regex:` is matched word by word, so a pattern must not contain a space inside a group.
# Starting the dev server directly is denied on purpose: use scripts/dev-up.sh.
# Not tested against a live agy session — if agy shows a "Settings Error", restore the backup.
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
echo "--- which model does which job right now (.agents/models.conf)"
scripts/agy-run.sh models 2>&1
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
      "command(scripts/gate.sh)", "command(scripts/step.sh)", "command(scripts/secret-scan.sh)",
      "command(scripts/dev-up.sh)", "command(scripts/dev-down.sh)", "command(scripts/db-reset.sh)",
      "command(scripts/notify.sh)", "command(scripts/agy-run.sh)",
      "command(npx tsc)", "command(npx vitest)", "command(npx -y modern-web-guidance@latest)",
      "command(npx supabase status)", "command(npx supabase migration)", "command(npx supabase gen)",
      "command(npx supabase db reset --local)",
      "command(npm ci)", "command(npm test)", "command(npm run build)", "command(npm run lint)",
      "command(node)",
      "command(ls)", "command(cat)", "command(head)", "command(tail)", "command(sed)", "command(grep)",
      "command(rg)", "command(find)", "command(wc)", "command(sort)", "command(uniq)", "command(cut)",
      "command(awk)", "command(date)", "command(mkdir)",
      "mcp(chrome-devtools/*)", "mcp(shadcn/*)"
    ],
    "deny": [
      "write_file(.git/)", "write_file(.env.local)",
      "command(git push --force)", "command(git push -f)", "command(git push --force-with-lease)",
      "command(regex:git push \\S+ \\S*main)",
      "command(regex:git push \\S+ \\S+ (--force|-f|--force-with-lease))",
      "command(git reset --hard)",
      "command(npx supabase db push)", "command(npx supabase link)", "command(npx supabase db pull)",
      "command(supabase db push)", "command(supabase link)", "command(supabase db pull)",
      "command(npm run dev)", "command(npx next dev)", "command(next dev)",
      "command(sudo)"
    ]
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
  echo "written. Check it loaded: run \`agy\`, type /permissions, then /loop-bootstrap."
fi
