#!/usr/bin/env bash
# Run ONE loop stage in a fresh headless session, on the program and model chosen
# for that job in .agents/stage-models.conf. Falls to the next entry of the role
# when a program is missing, at its usage limit, or the session fails.
#
#   scripts/stage.sh models                         what each role would use right now
#   scripts/stage.sh <role> <stage> "<arguments>"   stage: analyse | execute | verify | ship | decide | say
#       (stage `say`: the arguments are the whole prompt)
#
#   STAGE_PREFER=agy       the program that leads this run: its entries come first for briefs, builds and
#                          ships, and LAST for reviews (work is reviewed by another program); questions
#                          always follow the `decide` line
#   STAGE_MINUTES=120      time limit of the session (default per stage)
#   STAGE_DRY=1            do not start anything; print what would run (tests)
#
# Prints the session's final reply, then one line `MODEL-USED: <cli>:<model>`.
# Exit 0 done · 1 every entry failed (`MODEL-USED: none`) · 3 a program is at its usage
# limit and waiting helps (also prints `LIMIT-UNTIL: <unix time>`) · 130 stopped (Ctrl+C).
# A reply is not proof: scripts/night.sh checks the files and branches afterwards.
# A session that runs past its time limit is stopped and the next entry starts the same job.
#
# Checked 2026-11-24: the codex and claude flags against the installed programs.
# The agy lane: one minimal real session answered and ran a command (agy 1.5.16); no whole stage yet.
# First real run 2026-11-27: agy answered "--mode auto is not available for this account" and two
# sessions (a build and a brief, about 4 minutes) used up the account's weekly quota (docs/NIGHT.md).
# agy must run in the project folder or a full clone: inside a `git worktree` its sandbox cannot reach .git.
set -uo pipefail
# scripts/night.sh runs a copy of this file taken from v3: STAGE_ROOT is then the project folder, STAGE_CONF the table
cd "${STAGE_ROOT:-$(dirname "$0")/..}" || exit 1
conf=${STAGE_CONF:-.agents/stage-models.conf}
unset STAGE_ROOT STAGE_CONF      # used above only: never handed on to the sessions
tmp=${TMPDIR:-/tmp}; tmp=${tmp%/}
logdir="$HOME/Library/Logs"; mkdir -p "$logdir" 2>/dev/null || logdir=$tmp
app_cli="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"

have() {   # is the program installed (and allowed)?
  case "$1" in
    codex) command -v codex >/dev/null 2>&1 || [ -x "$app_cli" ] ;;
    claude) [ "${USE_CLAUDE:-1}" != 0 ] && [ ! -f .no-claude ] && command -v claude >/dev/null 2>&1 ;;
    # Antigravity is used only once its allow/deny rules are written (scripts/agy-setup.sh --write-permissions):
    # in `--mode auto` without them nothing forbids a raw push or a remote database command.
    agy) command -v agy >/dev/null 2>&1 && { [ "${AGY_NO_RULES_OK:-}" = 1 ] || grep -q '"deny"' "$HOME/.gemini/antigravity-cli/settings.json" 2>/dev/null; } ;;
    *) return 1 ;;
  esac
}
agy_models() {   # lines "id<TAB>label" of the account, cached for 10 minutes
  local c="$tmp/mnw-agy-models-$(id -u).txt"
  if [ ! -s "$c" ] || [ -n "$(find "$c" -mmin +10 2>/dev/null)" ]; then
    perl -e 'alarm 60; exec @ARGV' agy models </dev/null 2>/dev/null | grep -v '^Fetching' | grep -v '^[[:space:]]*$' > "$c.tmp" || true
    [ -s "$c.tmp" ] && mv "$c.tmp" "$c" || rm -f "$c.tmp"
  fi
  cat "$c" 2>/dev/null || true
}
agy_id() { local l; l=$(agy_models); grep -iE -- "$1" <<< "$l" | head -1 | cut -f1; }
limit_file() { echo "$tmp/mnw-limit-$1-$(id -u)"; }
limited_until() {   # unix time until which the program is at its usage limit, or 0
  local f t; f=$(limit_file "$1"); t=$(cat "$f" 2>/dev/null || echo 0)
  case "$t" in ''|*[!0-9]*) t=0 ;; esac
  [ "$t" -gt "$(date +%s)" ] && echo "$t" || echo 0
}
limit_secs() {      # seconds to wait, from "try again at 5:42 PM" / "resets 9pm" / "Resets in 167h56m7s"; 1800 when no time is given
  python3 -I - "$1" <<'PY'
import datetime, re, sys
# a length of time ("resets in 167h56m7s", "try again in 3 hours 20 minutes"): weekly quotas are given this way
d = re.search(r"(?:try again|resets?)\s+in\s+((?:\d+\s*(?:d|h|m|s)[a-z]*\s*)+)", sys.argv[1], re.I)
if d:
    unit = {"d": 86400, "h": 3600, "m": 60, "s": 1}
    secs = sum(int(n) * unit[u.lower()] for n, u in re.findall(r"(\d+)\s*([dhms])", d[1], re.I))
    print(min(secs + 120, 31 * 86400) if secs > 0 else 1800); sys.exit()
m = re.search(r"(?:try again at|resets?(?: at)?)\s+(\d{1,2})(?::(\d{2}))?\s*([AP]M)?", sys.argv[1], re.I)
if not m:
    print(1800); sys.exit()
h, mi, ap = int(m[1]), int(m[2] or 0), (m[3] or "").upper()
if ap == "PM" and h < 12: h += 12
if ap == "AM" and h == 12: h = 0
if h > 23 or mi > 59:
    print(1800); sys.exit()
now = datetime.datetime.now()
t = now.replace(hour=h, minute=mi, second=0, microsecond=0)
if t <= now:
    t = now if (now - t).total_seconds() < 900 else t + datetime.timedelta(days=1)
secs = int((t - now).total_seconds()) + 120
print(secs if secs <= 8 * 3600 else 1800)
PY
}
entries() {   # entries of a role, one per line, STAGE_PREFER's program first
  local row; row=$(grep -E "^$1[[:space:]]*=" "$conf" | head -1 | cut -d= -f2-)
  [ -n "$row" ] || { echo "unknown role '$1' — see $conf" >&2; return 1; }
  row=$(echo "$row" | tr '|' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$')
  local lead=${STAGE_PREFER:-}
  case "$1" in
    decide) lead="" ;;                         # questions always go to the model chosen for them
  esac
  if [ -z "$lead" ]; then echo "$row"; return 0; fi
  case "$1" in
    # the program that leads this run builds; its work is reviewed by the OTHER programs first
    review-*) grep -v "^$lead:" <<< "$row" || true; grep "^$lead:" <<< "$row" || true ;;
    *)        grep "^$lead:" <<< "$row" || true; grep -v "^$lead:" <<< "$row" || true ;;
  esac
}

if [ "${1:-}" = "models" ]; then
  for role in $(grep -E '^[a-z-]+[[:space:]]*=' "$conf" | cut -d= -f1); do
    line=""
    while read -r e; do
      cli=${e%%:*}
      if [ "$cli" = agy ] && command -v agy >/dev/null 2>&1 && ! have agy; then mark="(rules not written: scripts/agy-setup.sh --write-permissions)"
      elif ! have "$cli"; then mark="(not installed)"; elif [ "$cli" = agy ] && [ -z "$(agy_id "$(echo "$e" | cut -d: -f2)")" ]; then mark="(not on this account)"; elif [ "$(limited_until "$cli")" != 0 ]; then mark="(at its limit until $(date -r "$(limited_until "$cli")" '+%H:%M'))"; else mark=""; fi
      line="$line${line:+  →  }$e${mark:+ $mark}"
    done <<< "$(entries "$role")"
    printf '%-12s %s\n' "$role" "$line"
  done
  exit 0
fi

role=${1:?usage: scripts/stage.sh <role> <stage> "<arguments>"   or   scripts/stage.sh models}
stage=${2:?stage}; args=${3:-}
case "$stage" in
  analyse) mins=40 ;; execute) mins=120 ;; verify) mins=50 ;; ship) mins=40 ;; decide) mins=25 ;; say) mins=40 ;;
  *) echo "unknown stage '$stage'" >&2; exit 1 ;;
esac
mins=${STAGE_MINUTES:-$mins}
# the decide command already ends with its own line; a `STAGE: ok` after it used to hide the decision from the runner
decide_rule='The last line of your reply is exactly the one line the decide command asks for — `DECIDED: D<n> …` or `ASK: Q-<n> …` — with nothing after it (`STAGE: failed — <reason in one line>` only if you could not do either).'
tail_rule='The last line of your reply is exactly one of: `STAGE: ok` · `STAGE: question — <the question in one line>` (the owner or a decision is needed before this can go on) · `STAGE: failed — <reason in one line>`.'

prompt_for() {   # cli → the prompt that starts this stage there
  local cli=$1 tail_rule=$tail_rule
  [ "$stage" = decide ] && tail_rule=$decide_rule
  if [ "$stage" = say ]; then printf '%s\n\n%s' "$args" "$tail_rule"; return; fi
  case "$cli" in
    codex) printf '$loop-%s — use the loop-%s skill. Arguments: %s\n\n%s' "$stage" "$stage" "$args" "$tail_rule" ;;
    agy) printf 'Use the loop-%s skill with arguments: %s\n\n%s' "$stage" "$args" "$tail_rule" ;;
    # Claude Code has its own stage commands; its verify starts its own reviewers, so the word `self` is dropped.
    claude) printf '/%s %s\n\n%s' "$stage" "$(echo "$args" | awk '{o=""; for (i=1;i<=NF;i++) if ($i!="self") o=o (o?" ":"") $i; print o}')" "$tail_rule" ;;
  esac
}

until=0; tried=0; failed=0
out=$(mktemp); log_base="$logdir/mnw-stage-$(date +%Y%m%d-%H%M%S)-$$-$stage"
trap 'rm -f "$out"' EXIT
# Ctrl+C (or a stop) ends the stage: without this, a program that catches the interrupt and
# exits by itself looks like a failed session and the SAME job starts on the next program.
# bash runs this once the program has returned: one that ignores the interrupt delays the stop until it ends.
trap 'echo "[stage] stopped" >&2; echo "MODEL-USED: none"; exit 130' INT TERM
while read -r e; do
  [ -n "$e" ] || continue
  cli=$(echo "$e" | cut -d: -f1); model=$(echo "$e" | cut -d: -f2); effort=$(echo "$e" | cut -d: -f3)
  have "$cli" || continue
  lu=$(limited_until "$cli")
  if [ "$lu" != 0 ]; then { [ "$until" = 0 ] || [ "$lu" -lt "$until" ]; } && until=$lu; continue; fi
  tried=$((tried+1)); [ "$tried" -gt 3 ] && break
  prompt=$(prompt_for "$cli"); log="$log_base-$cli.log"; : > "$out"
  echo "[stage] $stage on $cli:$model${effort:+ ($effort)}   log: $log" >&2
  if [ "${STAGE_DRY:-}" = 1 ]; then echo "DRY $cli $model $effort :: $(echo "$prompt" | head -1)"; echo "MODEL-USED: $cli:$model"; exit 0; fi
  code=0
  case "$cli" in
    codex)
      cx=codex; command -v codex >/dev/null 2>&1 || cx="$app_cli"
      # --trust: project settings and rules under .codex/ load only for a trusted folder.
      # approval "never": nobody is there to answer; what the rules do not allow simply fails (and no approval reviewer runs).
      perl -e 'alarm shift; exec @ARGV' "$((mins*60))" "$cx" exec --trust --sandbox workspace-write \
        -c 'approval_policy="never"' ${effort:+-c "model_reasoning_effort=\"$effort\""} -m "$model" -o "$out" \
        "$prompt" </dev/null >"$log" 2>&1 || code=$? ;;
    claude)
      perl -e 'alarm shift; exec @ARGV' "$((mins*60))" claude -p "$prompt" --model "$model" \
        --permission-mode auto --output-format json </dev/null >"$log" 2>&1 || code=$?
      python3 -I - "$log" > "$out" <<'PY' || true
import json, sys
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
try:
    d = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    print(("" if not d.get("is_error") else "ERROR ") + (d.get("result") or ""))
except ValueError:
    print(raw[-3000:])
PY
      grep -q '^ERROR ' "$out" && code=1 ;;
    agy)
      id=$(agy_id "$model")
      [ -n "$id" ] || { echo "[stage] agy has no model matching '$model' on this account" >&2; tried=$((tried-1)); continue; }
      # shellcheck disable=SC2086
      # --mode auto: edits and the commands allowed in ~/.gemini/antigravity-cli/settings.json run without asking
      # (scripts/agy-setup.sh --write-permissions); anything else is refused, the run still exits 0.
      perl -e 'alarm shift; exec @ARGV' "$((mins*60+120))" agy -p "$prompt" --model "$id" ${effort:+--effort "$effort"} --mode auto \
        --print-timeout "${mins}m" --output-format json ${AGY_FLAGS:-} \
        </dev/null >"$log" 2>&1 || code=$?
      python3 -I - "$log" > "$out" <<'PY' || true
import json, sys
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
try:
    d = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    print(("" if d.get("status") == "SUCCESS" else "ERROR ") + (d.get("response") or d.get("error") or ""))
except ValueError:
    print("ERROR no result from agy\n" + raw[-2000:])
PY
      grep -q '^ERROR ' "$out" && code=1 ;;
  esac
  seen="$(tail -c 4000 "$log" 2>/dev/null) $(tail -c 2000 "$out" 2>/dev/null)"
  if [ "$code" != 0 ] || [ ! -s "$out" ]; then
    if grep -Eqi "usage limit|rate limit|limit reached|quota|resource.?exhausted|try again (in|at)|out of (extra )?usage|\b429\b" <<< "$seen"; then
      hint=$(grep -Eio '(try again (at|in)|resets?( at| in)?) [^.]{0,40}' <<< "$seen" | tail -1)
      secs=$(limit_secs "$hint"); case "$secs" in ''|*[!0-9]*) secs=1800 ;; esac
      lu=$(( $(date +%s) + secs )); echo "$lu" > "$(limit_file "$cli")"
      { [ "$until" = 0 ] || [ "$lu" -lt "$until" ]; } && until=$lu
      echo "[stage] $cli is at its usage limit until $(date -r "$lu" '+%a %d %H:%M') — next entry" >&2
      continue
    fi
    failed=$((failed+1))
    if grep -Eqi "not logged in|login required|401 unauthorized|please log in|not signed in|authentication required" <<< "$seen"; then
      echo "[stage] $cli is not signed in — next entry" >&2; continue
    fi
    echo "[stage] $cli:$model ended without a reply (exit $code) — next entry" >&2; continue
  fi
  cat "$out"; echo; echo "MODEL-USED: $cli:$model"; exit 0
done <<< "$(entries "$role")"

# A program at its limit will come back: waiting helps when that is within 6 hours, whatever the
# other entries did. A limit that ends far away (a weekly quota) is a reason to wait only when
# nothing else could be tried — otherwise the job itself failed on the programs that ran.
if [ "$until" != 0 ] && { [ "$failed" = 0 ] || [ $((until - $(date +%s))) -le 21600 ]; }; then
  echo "LIMIT-UNTIL: $until"; echo "MODEL-USED: none"; exit 3
fi
echo "MODEL-USED: none"; exit 1
