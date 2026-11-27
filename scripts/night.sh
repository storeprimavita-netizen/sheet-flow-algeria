#!/usr/bin/env bash
# Night run with a plain script as coordinator: no model is spent on waiting or
# on deciding the next stage. Every stage (brief, build, review, ship, decision)
# is ONE fresh headless session on the program and model chosen for that job in
# .agents/stage-models.conf (Codex, Antigravity CLI, Claude Code — D101).
# The script reads the result from git (plan row, brief, review files, branch),
# never from what a session says about itself.
#
#   scripts/night.sh                     main agent: any task, database tasks included
#   scripts/night.sh w2 nodb             extra agent in its own copy: only tasks without a migration
#   scripts/night.sh codex "" 3          stop after 3 tasks
#   Ctrl+C                               stop this run (pushed steps are kept; the task stays claimed and
#                                        the next run with the same name continues it)
#
#   STAGE_PREFER=agy|codex|claude        the program that leads this run: first for briefs, builds and
#                                        ships, last for reviews (scripts/stage.sh)
#   USE_CLAUDE=0  (or an empty file .no-claude)   never use Claude Code
#
# Usage limits: when every program for a job is at its limit, the run waits until
# the earliest reset time and continues by itself. The order of stages and the
# rules are those of .claude/commands/auto.md (two review rounds, questions never
# stop the run, follow-ups, hard stops).
# Written 2026-11-24. The coordinator logic is tested with stand-in stages
# (scripts/night.sh has no model of its own); no whole task has been run with it yet.
set -uo pipefail
tmp=${TMPDIR:-/tmp}; tmp=${tmp%/}
self_dir=$(cd "$(dirname "$0")" && pwd)
cd "${NIGHT_ROOT:-${NIGHT_HOME:-$self_dir/..}}" || exit 1
# The runner always runs as it is on v3, whatever branch this folder is on: a folder left on a
# task branch cut before a fix would otherwise bring the old runner back at every start.
# night.sh, stage.sh and the model table are copied out of origin/v3 and the run continues from
# that copy (started with NIGHT_ROOT = this folder). The gate, step.sh and the skills stay those of the branch.
# NIGHT_AS_IS=1 runs this file as it is (to try a change before it is on v3).
from_copy=""; runner_dir=""; root=$(pwd -P)
if [ -n "${NIGHT_ROOT:-}" ]; then from_copy=1; case "$self_dir" in */mnw-runner-??????) runner_dir=$self_dir ;; esac; fi
unset NIGHT_ROOT NIGHT_HOME      # used above only: never handed on to the sessions, the gate or a trial copy of this file
if [ -z "$from_copy" ] && [ -z "${STAGE_CMD:-}" ] && [ "${NIGHT_AS_IS:-}" != 1 ]; then
  # one copy per run (removed when the run ends): a second start never touches the files of a run that is going
  rd=$(mktemp -d "$tmp/mnw-runner-XXXXXX" 2>/dev/null) || rd=""
  git fetch -q origin v3 2>/dev/null || true
  if [ -n "$rd" ] && git show origin/v3:scripts/night.sh > "$rd/night.sh" 2>/dev/null && git show origin/v3:scripts/stage.sh > "$rd/stage.sh" 2>/dev/null \
     && git show origin/v3:.agents/stage-models.conf > "$rd/stage-models.conf" 2>/dev/null \
     && grep -q 'NIGHT_ROOT' "$rd/night.sh" && grep -q 'STAGE_ROOT' "$rd/stage.sh"; then
    chmod +x "$rd/stage.sh"; NIGHT_ROOT=$root exec bash "$rd/night.sh" ${1+"$@"}
  fi
  [ -n "$rd" ] && rm -rf "$rd"
fi
[ -n "$runner_dir" ] && trap 'rm -rf "$runner_dir"' EXIT
if [ -n "$from_copy" ]; then stage_default="$self_dir/stage.sh"; else stage_default=scripts/stage.sh; fi
# the copied stage.sh is told where the project and the table are — for that one call only
stage_run() { if [ -n "$from_copy" ]; then STAGE_ROOT=$root STAGE_CONF="$self_dir/stage-models.conf" "$STAGE" "$@"; else "$STAGE" "$@"; fi; }
name=${1:-codex}; filter=${2:-}; max=${3:-0}
case "$filter" in ""|nodb) ;; *) echo "usage: scripts/night.sh [name] [nodb] [max tasks]"; exit 1 ;; esac
case "$max" in ''|*[!0-9]*) echo "usage: scripts/night.sh [name] [nodb] [max tasks]"; exit 1 ;; esac
STAGE=${STAGE_CMD:-$stage_default}; GATE=${GATE_CMD:-scripts/gate.sh}
say() { echo "$(date '+%H:%M') ── [$name] $*"; }
note() { scripts/notify.sh "$1" >/dev/null 2>&1 || true; }

[ -d node_modules ] || [ -n "${STAGE_CMD:-}" ] || { say "node_modules missing — run: npm ci"; exit 1; }
[ -f .night-run ] && { rm -f .night-run; say "a chat night run was marked as on in this folder — this terminal run takes over (do not continue that chat)"; }
# one run per folder and name: a second one would switch branches under the first
lock="$tmp/mnw-night-$name-$(pwd -P | cksum | cut -d' ' -f1).lock"
if ! mkdir "$lock" 2>/dev/null; then
  if kill -0 "$(cat "$lock/pid" 2>/dev/null)" 2>/dev/null; then say "a night run named '$name' is already running in this folder (pid $(cat "$lock/pid")) — not starting a second one"; exit 1; fi
  rm -rf "$lock"; mkdir "$lock" || { say "cannot create $lock"; exit 1; }
fi
echo $$ > "$lock/pid"
command -v caffeinate >/dev/null 2>&1 && caffeinate -ims -w $$ &
[ "$filter" = "nodb" ] && export GATE_SKIP_LIVE=1
reply=$(mktemp); shipped=""; parked=""; used=""; started=$(date +%s)
trap 'rm -rf "$reply" "$lock" ${runner_dir:+"$runner_dir"}; scripts/dev-down.sh >/dev/null 2>&1' EXIT
trap 'echo; say "stopped by you — pushed steps are kept"; exit 130' INT TERM

# ---- reading the state from git -------------------------------------------------
plan() { git show v3:docs/MASTER_PLAN.md; }
row() { plan | grep -m1 -E "^\| $1 \|"; }
status_of() { row "$1" | awk -F'|' '{s=$(NF-1); gsub(/^ +| +$/,"",s); print s}'; }
has_migration() { [ "$(row "$1" | awk -F'|' '{m=$(NF-4); gsub(/ /,"",m); print m}')" = "M" ]; }
is_followup() { local t; t=$(row "$1" | awk -F'|' '{print $3}'); grep -qiE '^ *(\*\*)?follow-up' <<< "$t"; }
claimed_count() { plan | awk -F'|' -v n="claimed:$name" 'NF>9 {s=$(NF-1); gsub(/^ +| +$/,"",s); if (s==n) c++} END {print c+0}'; }
claimed() { plan | awk -F'|' -v n="claimed:$name" 'NF>9 {s=$(NF-1); gsub(/^ +| +$/,"",s); if (s==n) {id=$2; gsub(/ /,"",id); print id; exit}}'; }
branch_exists() { git rev-parse -q --verify "refs/heads/v3-$1" >/dev/null; }
refs_of() { if branch_exists "$1"; then echo "v3-$1 v3"; else echo v3; fi; }
file_ref() {   # the ref that holds a task file (the task branch wins), or nothing
  local r; for r in $(refs_of "$1"); do git cat-file -e "$r:$2" 2>/dev/null && { echo "$r"; return 0; }; done; return 1
}
brief_header() { local r b; r=$(file_ref "$1" "docs/briefs/$1.md") || return 1; b=$(git show "$r:docs/briefs/$1.md") || return 1; head -12 <<< "$b" | tr 'A-Z' 'a-z'; return 0; }
last_review() {  # highest review number of the task, or nothing (0 = review of the brief)
  local r; for r in $(refs_of "$1"); do git ls-tree --name-only "$r" docs/briefs/ 2>/dev/null; done \
    | sed -n "s#^docs/briefs/$1\.review-\([0-9][0-9]*\)\.md\$#\1#p" | sort -n | tail -1
}
verdict_of() { local r; r=$(file_ref "$1" "docs/briefs/$1.review-$2.md") || return 1; git show "$r:docs/briefs/$1.review-$2.md" | head -1 | sed 's/^VERDICT:[[:space:]]*//' | tr -d '\r '; }
time_of() {     # commit time of the last change to the given paths on the task's refs (0 when none)
  local id=$1 r t best=0; shift
  for r in $(refs_of "$id"); do t=$(git log -1 --format=%ct "$r" -- "$@" 2>/dev/null); [ -n "$t" ] && [ "$t" -gt "$best" ] && best=$t; done; echo "$best"
}
code_time() {   # commit time of the last real work on the task branch (not briefs, reviews, plan or log), 0 when none
  branch_exists "$1" || { echo 0; return; }
  local t; t=$(git log -1 --format=%ct "v3..v3-$1" -- . ':(exclude)docs/briefs' ':(exclude)docs/MASTER_PLAN.md' ':(exclude)PROGRESS.md' 2>/dev/null); echo "${t:-0}"
}
built() { [ "$(code_time "$1")" != 0 ]; }
cut_off() { branch_exists "$1" && git log -1 --format=%s "v3-$1" | grep -q '^wip:'; }   # the last commit is work saved from a session that was cut off

# ---- acting ---------------------------------------------------------------------
to_v3() {       # leave whatever branch a session ended on, without losing files
  local cur; cur=$(git branch --show-current)
  if [ -n "$(git status --porcelain)" ]; then
    if [ "$cur" != v3 ] && [ -n "$cur" ]; then say "uncommitted files on $cur — saved there as a step"; scripts/step.sh "wip: files left on $cur when a session ended (not gated)" >/dev/null || return 1
    else say "leftover files on v3 — set aside with git stash"; git stash push -u -q -m "night leftovers $name $(date +%F-%H%M)" || return 1; fi
  fi
  [ "$cur" = v3 ] || git checkout -q v3 || return 1
  local try
  for try in 1 2 3 4; do            # offline for a moment must not end the night; a conflict must not leave a half rebase
    git pull --rebase -q origin v3 2>/dev/null && return 0
    git rebase --abort 2>/dev/null || true
    [ "$try" = 4 ] || sleep "${NIGHT_SLEEP_CAP:-90}"
  done
  return 1
}
run_stage() {   # role stage args → the reply in $reply; waits and retries when everything is at its limit
  local role=$1 stage=$2 args=$3 code t0 model wait_s
  while :; do
    t0=$(date +%s); : > "$reply"
    stage_run "$role" "$stage" "$args" > "$reply" 2>>"$tmp/mnw-night-$name.err"; code=$?
    model=$(grep '^MODEL-USED: ' "$reply" | tail -1 | cut -d' ' -f2)
    # the stage was stopped (Ctrl+C in this window, or a stop sent to it): the run stops too, it does not go on to the next stage
    if [ "$code" = 130 ]; then echo; say "stopped by you — pushed steps are kept"; exit 130; fi
    if [ "$code" = 3 ]; then
      wait_s=$(( $(grep '^LIMIT-UNTIL: ' "$reply" | tail -1 | cut -d' ' -f2) - $(date +%s) + 60 )); [ "$wait_s" -gt 60 ] 2>/dev/null || wait_s=1800
      if [ "$wait_s" -gt 43200 ]; then why="every program for '$role' is at its usage limit until $(date -v+"${wait_s}"S '+%a %d %b %H:%M') — start again then"; finish; exit 0; fi
      waited=$(( ${waited:-0} + wait_s ))
      if [ "$waited" -gt 43200 ]; then why="every program has been at its usage limit for 12 hours — start again when the limit is back"; finish; exit 0; fi
      say "usage limit on every program for '$role' — continuing by itself at $(date -v+"${wait_s}"S '+%H:%M')"
      note "[$name] usage limit — the run continues at $(date -v+"${wait_s}"S '+%H:%M')"
      sleep "${NIGHT_SLEEP_CAP:-$wait_s}"; continue
    fi
    waited=0; used="$used$stage:$model "
    say "   $stage  ·  ${model:-none}  ·  $(( ($(date +%s) - t0) / 60 )) min"
    return "$code"
  done
}
stage_line() { grep -E '^(STAGE|DECIDED|ASK):' "$reply" | tail -1; }
park() {        # id reason — set the row to blocked on v3 and go on with other tasks
  local id=$1 why=$2
  to_v3 || return 1
  python3 -I - "$id" "$why" <<'PY' || return 1
import sys
p = "docs/MASTER_PLAN.md"; id, why = sys.argv[1], sys.argv[2].replace("|", "/")
out = []
for l in open(p, encoding="utf-8").read().split("\n"):
    if l.startswith("| %s |" % id):
        c = l.rstrip().rstrip("|").split("|"); c[-1] = " blocked:%s " % why; l = "|".join(c) + "|"
    out.append(l)
open(p, "w", encoding="utf-8").write("\n".join(out))
PY
  scripts/step.sh "$id: park — $why" >/dev/null || { say "could not push the park of $id"; return 1; }
  parked="$parked$id($why) "; say "■ $id parked — $why"; note "[$name] $id parked — $why"
}
decide() {      # id question → 0 decided (go on), 1 parked
  local id=$1 q=$2 line
  run_stage decide decide "$id $q"; line=$(grep -E '^(DECIDED|ASK):' "$reply" | tail -1)   # not stage_line: `STAGE: ok` may follow it
  to_v3 || true
  case "$line" in
    DECIDED:*) say "   decision: ${line#DECIDED: }"; return 0 ;;
    ASK:*) q=$(grep -oE 'Q-[0-9]+' <<< "$line" | head -1); park "$id" "${q:-owner question}"; note "[$name] question for you — ${line#ASK: }"; return 1 ;;
    *) park "$id" "question not settled — see docs/briefs/$id.md"; return 1 ;;
  esac
}
gate_ok() {     # id → is the full gate OK on the head of the task branch?
  local id=$1 stamp="$tmp/mnw-gate-ok-$(pwd -P | cksum | cut -d' ' -f1)"
  [ "$(cat "$stamp" 2>/dev/null)" = "$(git rev-parse "v3-$id")" ] && return 0     # the builder's own full gate, same commit
  to_v3 || return 1; git checkout -q "v3-$id" || return 1
  "$GATE" > "$tmp/mnw-night-gate-$name.log" 2>&1; local c=$?
  [ "$c" = 0 ] || say "   gate not OK: $(grep -E '^FAIL' "$tmp/mnw-night-gate-$name.log" | head -3 | tr '\n' ' ' | cut -c1-200)"
  return "$c"
}

do_task() {     # id [question] → 0 shipped, 1 parked or lost
  local id=$1 steps=0 gatefail=0 shipfail=0 nobrief=0 decided="" same=0 lastsig="" sig hdr risk surf role brole n v st rounds line
  if [ -n "${2:-}" ]; then decide "$id" "$2" || return 1; fi      # the session that picked the task already raised a question
  while [ "$steps" -lt 18 ]; do
    steps=$((steps+1)); to_v3 || { say "cannot return to v3"; return 1; }
    st=$(status_of "$id")
    case "$st" in
      done) shipped="$shipped$id($(git log -1 --format=%h --grep="Merge v3-$id " v3)) "; say "✔ $id shipped"; note "[$name] $id shipped"; return 0 ;;
      "claimed:$name") ;;
      *) say "$id is now '$st' — leaving it"; return 1 ;;
    esac
    # 1. brief
    if ! hdr=$(brief_header "$id"); then
      nobrief=$((nobrief+1)); [ "$nobrief" -gt 2 ] && { park "$id" "no brief after two tries"; return 1; }
      run_stage brief analyse "$id as:$name"; line=$(stage_line)
      case "$line" in "STAGE: question"*) decide "$id" "${line#STAGE: question}" || return 1 ;; esac
      continue
    fi
    risk=low; grep -qE 'risk:[^a-z]*high' <<< "$hdr" && risk=high
    surf=$(grep -m1 -oE 'surface:[^·]*' <<< "$hdr" || true)
    if grep -qE '(^|[^a-z])sec(urity)?([^a-z]|$)' <<< "$surf"; then role=review-sec
    elif [ "$risk" = high ]; then role=review-high
    elif grep -qE '(^|[^a-z])ui([^a-z]|$)' <<< "$surf"; then role=review-ui
    else role=""; fi
    if [ "$risk" = high ]; then brole=build-high; elif is_followup "$id" && ! has_migration "$id"; then brole=build-small; else brole=build; fi
    n=$(last_review "$id"); v=""; [ -n "$n" ] && v=$(verdict_of "$id" "$n")
    # the same state after two sessions in a row means the sessions are not moving the task: stop spending on it
    sig="$n|$v|$(code_time "$id")|$(time_of "$id" "docs/briefs/$id.md")|$decided|$(git rev-parse -q --verify "refs/heads/v3-$id" || true)"
    if [ "$sig" = "$lastsig" ]; then same=$((same+1)); else same=0; fi; lastsig=$sig
    [ "$same" -ge 2 ] && { park "$id" "two sessions in a row changed nothing — look at v3-$id"; return 1; }
    # 2. review of the design before any code: high risk with a migration (auto.md step 2)
    if ! built "$id"; then
      if [ "$risk" = high ] && has_migration "$id" && [ -z "$n" ]; then run_stage "$role" verify "docs/briefs/$id.md self"; continue; fi
      if [ "$n" = 0 ] && [ "$v" = FIX ] && [ "$(time_of "$id" "docs/briefs/$id.md")" -le "$(time_of "$id" "docs/briefs/$id.review-0.md")" ]; then
        run_stage brief analyse "$id as:$name — revise the brief after the design review docs/briefs/$id.review-0.md"; continue
      fi
      if [ "$n" = 0 ] && [ "$v" = ESCALATE ] && [ "$decided" != 0 ]; then decided=0; decide "$id" "docs/briefs/$id.review-0.md" || return 1; continue; fi
    fi
    # 3. build, or fix what the last review listed
    if ! built "$id" || cut_off "$id" || { [ "${n:-0}" = 1 ] && [ "$v" != PASS ] && [ "$(code_time "$id")" -le "$(time_of "$id" "docs/briefs/$id.review-$n.md")" ]; }; then
      if [ "$v" = ESCALATE ] && [ "$n" != 0 ] && [ "$decided" != "$n" ]; then decided=$n; decide "$id" "docs/briefs/$id.review-$n.md" || return 1; continue; fi
      if ! built "$id" && has_migration "$id"; then say "   local database reset (the task has a migration)"; scripts/db-reset.sh >/dev/null 2>&1 || say "   db-reset failed — the build will report it"; fi
      if cut_off "$id"; then run_stage "$brole" execute "$id as:$name — a previous session was cut off before finishing: continue the brief from the last commit of the branch, check every step of the brief is done, then run the full gate"
        if cut_off "$id"; then park "$id" "cut-off work was not continued — look at v3-$id"; return 1; fi
      else run_stage "$brole" execute "$id as:$name"; fi
      line=$(stage_line)
      case "$line" in "STAGE: question"*) decide "$id" "${line#STAGE: question}" || return 1; continue ;; esac
      built "$id" || { gatefail=$((gatefail+1)); [ "$gatefail" -ge 2 ] && { park "$id" "build produced no code twice"; return 1; }; continue; }
      if ! gate_ok "$id"; then
        gatefail=$((gatefail+1)); [ "$gatefail" -ge 2 ] && { park "$id" "gate failed twice — built on v3-$id"; return 1; }
        [ "$brole" = build-small ] && brole=build      # a cheap model that fails the gate hands over to the next one
        run_stage "$brole" execute "$id as:$name — the full gate is not OK: fix what scripts/gate.sh reports"; gate_ok "$id" || { park "$id" "gate failed twice — built on v3-$id"; return 1; }
      fi
      continue
    fi
    # 4. review of the build (risk high or a surface), at most two rounds
    if [ -n "$role" ]; then
      rounds=0; [ -n "$n" ] && rounds=$n
      if [ "$rounds" = 0 ]; then run_stage "$role" verify "$id self"; continue; fi
      if [ "$v" != PASS ]; then
        if [ "$v" = ESCALATE ] && [ "$decided" != "$n" ]; then decided=$n; decide "$id" "docs/briefs/$id.review-$n.md" || return 1; continue; fi
        if [ "$rounds" -lt 2 ]; then run_stage "$role" verify "$id self recheck"; continue; fi
        # rounds used up: ship with follow-ups when no high finding is open (D40, D89), else park
        run_stage "$brole" say "Task $id on branch v3-$id has used its two review rounds; the last review is docs/briefs/$id.review-$n.md. Follow .claude/commands/auto.md, section 'Follow-ups and merging without the owner (D40, D89)'. If a HIGH finding is still open, change nothing and reply 'STAGE: failed — high finding open: <which>'. Otherwise: put the open medium findings into ONE follow-up row in docs/MASTER_PLAN.md, the low ones into docs/BACKLOG.md, record the decision row, then ship the task exactly as .claude/commands/ship.md describes (its precondition is replaced by this rule), committing with scripts/step.sh and never touching main."
        to_v3 || true; [ "$(status_of "$id")" = done ] && continue
        say "   $(stage_line | cut -c1-160)"; park "$id" "review rounds used up with a high finding open — built on v3-$id"; return 1
      fi
    fi
    # 5. ship
    run_stage ship ship "$id"; to_v3 || true
    [ "$(status_of "$id")" = done ] && continue
    shipfail=$((shipfail+1)); [ "$shipfail" -ge 2 ] && { say "   $(stage_line | cut -c1-160)"; park "$id" "ship failed twice — built on v3-$id"; return 1; }
  done
  park "$id" "too many stages without finishing — look at v3-$id"; return 1
}

finish() {      # the end of every run: back on v3, the report in PROGRESS.md, the last lines
  to_v3 || true
  if [ -n "$shipped$parked" ]; then
    { echo; echo "### Run report (night.sh, $name, $(date +%F))"
      echo "- Shipped — ${shipped:-none}"; echo "- Parked — ${parked:-none}"
      echo "- Sessions (stage:program:model) — $(echo "$used" | tr ' ' '\n' | grep -v '^$' | sort | uniq -c | awk '{printf "%s×%s ", $1, $2}')"
      echo "- Time — $(( ($(date +%s) - started) / 60 )) min. Open questions: docs/QUESTIONS.md."; } >> PROGRESS.md
    scripts/step.sh "night run report ($name)" >/dev/null || say "could not push the run report"
  fi
  say "NIGHT RUN ended · $why"; say "shipped: ${shipped:-none}"; say "parked: ${parked:-none}"
  note "[$name] night run ended — shipped: ${shipped:-none} · parked: ${parked:-none}"
}

# ---- the run --------------------------------------------------------------------
say "night run · claim name $name · ${filter:-all tasks}${STAGE_PREFER:+ · prefers $STAGE_PREFER}"
stage_run models 2>/dev/null | sed 's/^/        /'
[ -n "${STAGE_CMD:-}" ] || scripts/dev-up.sh | sed 's/^/        /'
note "[$name] night run started"
# Files not committed when the run starts: only the cut-off work of this agent's own claimed task is taken over.
if [ -n "$(git status --porcelain)" ]; then
  cur=$(git branch --show-current); mine=$(claimed)
  if [ -n "$mine" ] && [ "$cur" = "v3-$mine" ]; then say "uncommitted files on $cur (task $mine, claimed by $name) — they are saved there as a step and the task continues"
  else say "NIGHT RUN not started · there are uncommitted files on '$cur' that do not belong to a task claimed by '$name' — commit or set them aside first (git status)"; exit 1; fi
fi
n=0; idle=0; why="nothing left that can run without you"
while :; do
  [ "$max" -gt 0 ] && [ "$n" -ge "$max" ] && { why="$max task(s) done, as asked"; break; }
  to_v3 || { why="could not update v3"; break; }
  id=$(claimed)
  ask=""
  if [ -z "$id" ]; then
    run_stage brief analyse "$filter as:$name — first apply the 'Start of run' rule of .claude/commands/auto.md for questions the owner has answered in docs/QUESTIONS.md; then, if a row already reads claimed:$name (a session before you was cut off after claiming), that row is your task — brief it and claim nothing else; otherwise pick by its 'Pick' rule (feature rows before follow-up rows). If no task is eligible, change nothing and end with the line 'STAGE: nothing-eligible'."
    code=$?; ask=$(stage_line); case "$ask" in "STAGE: question"*) ask=${ask#STAGE: question} ;; *) ask="" ;; esac
    to_v3 || true; id=$(claimed)
    # two rows claimed at once (a cut-off session claimed one, the next claimed another): the question may belong to either
    if [ -n "$ask" ] && [ "$(claimed_count)" -gt 1 ]; then say "   more than one row is claimed by $name — the picking session's question is not carried to $id:$ask"; ask=""; fi
    if [ -z "$id" ]; then
      grep -q '^STAGE: nothing-eligible' "$reply" && break
      idle=$((idle+1)); [ "$idle" -ge 3 ] && { why="three sessions in a row picked nothing — see $HOME/Library/Logs"; break; }
      say "no task was claimed (exit $code) — trying again in 2 min ($idle/3)"; sleep "${NIGHT_SLEEP_CAP:-120}"; continue
    fi
  fi
  [ "$id" = "${last_id:-}" ] && { why="$id is still claimed after a full attempt — look at it"; break; }
  last_id=$id; idle=0; n=$((n+1)); t0=$(date +%s); say "▶ $id"
  do_task "$id" "$ask"; say "   $id took $(( ($(date +%s) - t0) / 60 )) min"
  command -v graphify >/dev/null 2>&1 && [ -f graphify-out/graph.json ] && to_v3 && GRAPHIFY_BACKEND=none graphify update . >/dev/null 2>&1   # keep the code map current, no model involved
done

finish
