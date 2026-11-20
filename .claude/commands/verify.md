---
description: Loop stages 2 and 5 — independent review of a brief or of a task's diff, routed by risk and surface; writes a verdict file
model: sonnet
effort: medium
context: fork
---
$ARGUMENTS is a brief path (review the design before any code) or a task id (review the diff `git diff v3...v3-<id>`).

Read docs/briefs/<id>.md for the intended behavior, risk and surface, plus the DECISIONS rows it cites. Do not read any builder summary.

Route:
- brief path, or `risk: high`, or `surface` contains `security` → spawn the `qa-reviewer` agent (with the `owasp-security` skill when the surface is security).
- `surface` contains `ui` → spawn the `ui-reviewer` agent.
- both apply → spawn both in one message and wait for both.
Give each reviewer the brief path and the diff command, never a conclusion.

Find the next free n (review-0 is the brief review; diffs start at 1) and write docs/briefs/<id>.review-<n>.md: first line exactly `VERDICT: PASS`, `VERDICT: FIX` or `VERDICT: ESCALATE`, then `## Summary` (≤ 5 lines), then ranked findings (severity, file:line, concrete failure or exploit, fix) and missing tests. PASS only if no finding is high or medium. ESCALATE if n ≥ 3 without PASS, or a finding needs an owner decision. Commit with `scripts/step.sh "<id>: review <n> <verdict>"`.

Return the verdict line and the review file path. Under 60 words. Do not edit code.

If $ARGUMENTS ends with `recheck`: this is a re-check after a fix. Give the reviewer the previous review file and `git diff` of the fix commits only; it confirms each listed finding is fixed and looks for a regression in the touched lines — it does not review the task again from zero, and does not go looking for new low findings. Use `qa-reviewer` (opus) only when the brief says `risk: high` or the surface is security; a UI-only task is reviewed by `ui-reviewer` alone.
