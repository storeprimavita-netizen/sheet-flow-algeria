#!/usr/bin/env bash
# High-risk / security review by Claude Opus, started from another agent (Codex).
# Runs Claude Code headless as the read-only `qa-reviewer` (.claude/agents/).
# Prints the findings, then one last line:
#   MODEL-USED: claude-opus     the reply above is the review
#   MODEL-USED: none            Claude was not available (not installed, not signed
#                               in, usage limit, no REVIEW-END line) — the caller
#                               uses its own reviewer instead
#
#   scripts/review-high.sh <task id>                       review git diff v3...v3-<id>
#   scripts/review-high.sh <task id> brief                 review the brief before any code
#   scripts/review-high.sh <task id> recheck "<findings>"  re-check only the listed findings
#
#   REVIEW_MODEL=opus   REVIEW_TIMEOUT=1500 (seconds)
#   Switch it off: REVIEW_WITH_CLAUDE=0, or an empty file .no-claude-review in the project folder
set -uo pipefail
cd "$(dirname "$0")/.."
id=${1:?usage: scripts/review-high.sh <task id> [brief | recheck "<findings>"]}
mode=${2:-diff}; extra=${3:-}
none() { echo "[review-high] $*" >&2; echo "MODEL-USED: none"; exit 1; }
[ "${REVIEW_WITH_CLAUDE:-1}" = "1" ] || none "switched off (REVIEW_WITH_CLAUDE=0)"
[ -e .no-claude-review ] && none "switched off (file .no-claude-review exists)"
command -v claude >/dev/null 2>&1 || none "claude is not installed"
[ -f "docs/briefs/$id.md" ] || none "no brief docs/briefs/$id.md"
case "$mode" in
  brief)   what="Review the DESIGN in the brief before any code is written: docs/briefs/$id.md." ;;
  recheck) what="Re-check task $id after a fix. Brief: docs/briefs/$id.md. Diff: git diff v3...v3-$id. Look ONLY at these findings and at regressions in the lines the fix touched: $extra" ;;
  *)       what="Review task $id. Brief: docs/briefs/$id.md. Diff: git diff v3...v3-$id." ;;
esac
prompt="$what You are read-only: do not edit, create or delete files, do not commit. End your reply with the line: REVIEW-END: <h> high, <m> medium, <l> low"
out=$(mktemp); trap 'rm -f "$out"' EXIT
# perl gives a time limit without needing coreutils `timeout` on macOS
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT \
  perl -e 'alarm shift; exec @ARGV' "${REVIEW_TIMEOUT:-1500}" \
  claude -p "$prompt" --agent qa-reviewer --model "${REVIEW_MODEL:-opus}" --permission-mode auto \
         --disallowedTools Edit Write NotebookEdit --output-format json </dev/null >"$out" 2>/dev/null
code=$?
reply=$(python3 -I - "$out" <<'PY'
import json, sys
raw = open(sys.argv[1], errors="replace").read()
try:
    data = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
except ValueError:
    sys.exit(1)
if data.get("is_error"):
    sys.exit(1)
print(data.get("result") or "")
PY
) || none "claude gave no usable result (exit $code) — signed out or usage limit"
[ "$code" = "0" ] || none "claude exited $code"
echo "$reply" | grep -q '^REVIEW-END:' || none "reply has no REVIEW-END line (usage limit or cut off)"
echo "$reply"
echo "MODEL-USED: claude-${REVIEW_MODEL:-opus}"
