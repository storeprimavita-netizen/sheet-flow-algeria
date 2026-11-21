#!/usr/bin/env bash
# Run one loop stage on the Antigravity model chosen for that job, falling back
# to the next model in the row when one is not available or fails (usage limit).
# Roles and their model order: .agents/models.conf
#
#   scripts/agy-run.sh models                       what each role would use right now
#   scripts/agy-run.sh pick <role>                  print the model id for a role
#   scripts/agy-run.sh chain <role>                 all usable model ids for a role, best first
#   scripts/agy-run.sh run <role> [options] -- "<prompt>"
#       --agent <name>          run as that agent (.agents/agents/<name>.md)
#       --expect-file <path>    the stage must leave this file behind
#       --expect-text <regex>   the reply must contain a line matching this
#       --timeout <dur>         per attempt, default 45m
#       --tries <n>             how many models to try at most, default 4
#
# A stage counts as done only when agy reports SUCCESS and the --expect checks
# hold: headless agy exits 0 even when it refused an action, so the exit code
# alone proves nothing. The last line printed is `MODEL-USED: <id>` or
# `MODEL-USED: none` (exit 1).
#
# NOT TESTED against a live model when written (2026-11-21): the Gemini 4 and
# Opus 5.5 models were locked on the owner's account. Flags and the JSON shape
# are from antigravity.google/docs/cli/headless.
set -uo pipefail
cd "$(dirname "$0")/.."
conf=.agents/models.conf
cache="${TMPDIR:-/tmp}/mnw-agy-models-$(id -u).txt"

available() {   # lines "id<TAB>label", cached for 10 minutes
  if [ -n "${AGY_MODELS_FILE:-}" ]; then cat "$AGY_MODELS_FILE"; return; fi
  if [ ! -s "$cache" ] || [ -n "$(find "$cache" -mmin +10 2>/dev/null)" ]; then
    command -v agy >/dev/null 2>&1 || { echo "agy is not installed" >&2; return 1; }
    agy models 2>/dev/null | grep -v '^Fetching' | grep -v '^[[:space:]]*$' > "$cache.tmp" || true
    [ -s "$cache.tmp" ] && mv "$cache.tmp" "$cache" || { rm -f "$cache.tmp"; echo "agy models returned nothing (not signed in?)" >&2; return 1; }
  fi
  cat "$cache"
}

chain() {       # model ids for a role, best first, only models the account lists
  local role=$1 row
  row=$(grep -E "^$role[[:space:]]*=" "$conf" | head -1 | cut -d= -f2-)
  [ -n "$row" ] || { echo "unknown role '$role' — see $conf" >&2; return 1; }
  local list; list=$(available) || return 1
  echo "$row" | tr '|' '\n' | while read -r pat; do
    [ -n "$pat" ] || continue
    echo "$list" | grep -iE -- "$pat" | head -1 | cut -f1
  done | awk 'NF && !seen[$0]++'
}

case "${1:-}" in
  models)
    for role in $(grep -E '^[a-z-]+[[:space:]]*=' "$conf" | cut -d= -f1); do
      printf '%-12s %s\n' "$role" "$(chain "$role" | paste -sd' ' - | sed 's/ /  →  /g')"
    done ;;
  pick)
    m=$(chain "${2:?role}" | head -1); [ -n "$m" ] || exit 1; echo "$m" ;;
  chain)
    chain "${2:?role}" ;;
  run)
    role=${2:?role}; shift 2
    agent=""; efile=""; etext=""; timeout=45m; tries=4
    while [ $# -gt 0 ]; do case "$1" in
      --agent) agent=$2; shift 2 ;; --expect-file) efile=$2; shift 2 ;;
      --expect-text) etext=$2; shift 2 ;; --timeout) timeout=$2; shift 2 ;;
      --tries) tries=$2; shift 2 ;; --) shift; break ;; *) break ;;
    esac; done
    prompt=${1:?prompt}
    models=$(chain "$role") || { echo "MODEL-USED: none"; exit 1; }
    [ -n "$models" ] || { echo "[agy-run] no model available for $role" >&2; echo "MODEL-USED: none"; exit 1; }
    out=$(mktemp); err=$(mktemp); trap 'rm -f "$out" "$err"' EXIT
    n=0
    while read -r model; do
      n=$((n+1)); [ "$n" -gt "$tries" ] && break
      [ -n "$efile" ] && before=$(stat -f %m "$efile" 2>/dev/null || echo 0)
      echo "[agy-run] $role on $model (attempt $n)" >&2
      # shellcheck disable=SC2086
      agy -p "$prompt" --model "$model" ${agent:+--agent "$agent"} --output-format json --print-timeout "$timeout" </dev/null >"$out" 2>"$err"
      code=$?
      verdict=$(EFILE="$efile" ETEXT="$etext" BEFORE="${before:-0}" CODE="$code" python3 - "$out" <<'PY'
import json, os, re, sys
raw = open(sys.argv[1], errors="replace").read()
try:
    data = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
except ValueError:
    print("FAIL no JSON result from agy"); sys.exit()
status, reply = data.get("status"), data.get("response") or ""
if os.environ["CODE"] != "0" or status != "SUCCESS":
    print("FAIL status %s: %s" % (status, (data.get("error") or "")[:200])); sys.exit()
ef, et = os.environ["EFILE"], os.environ["ETEXT"]
if ef and (not os.path.exists(ef) or os.path.getmtime(ef) <= float(os.environ["BEFORE"])):
    print("FAIL finished but did not write " + ef); sys.exit()
if et and not re.search(et, reply, re.M):
    print("FAIL finished but the reply has no line matching " + et); sys.exit()
print("OK"); print(reply)
PY
)
      if [ "${verdict%%$'\n'*}" = "OK" ]; then
        echo "${verdict#OK}" | sed 1d
        echo "MODEL-USED: $model"; exit 0
      fi
      echo "[agy-run] $model: ${verdict#FAIL } $(grep -iE 'denied|quota|limit|exhaust' "$err" | head -2 | tr '\n' ' ')" >&2
    done <<< "$models"
    echo "MODEL-USED: none"; exit 1 ;;
  *) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
