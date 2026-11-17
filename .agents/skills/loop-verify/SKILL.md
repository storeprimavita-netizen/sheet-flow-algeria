---
name: loop-verify
description: Loop stages 2 and 5 on the MNW project — independent review of a brief or of a task's diff, writing a verdict file docs/briefs/<id>.review-<n>.md. Use when asked to verify or review a task id or a brief path, and always before shipping high-risk or UI work.
---
Follow the body of `.claude/commands/verify.md` exactly, with these substitutions:
- Ignore its frontmatter (Claude Code settings).
- "Spawn the `qa-reviewer` / `ui-reviewer` agent" = start the subagent of the same name defined in `.agents/agents/`. Give it the brief path and the diff command, never a conclusion. If both apply, run both and wait for both.
- The review must be done by a subagent that did not write the code. If you built this task in this same conversation and cannot start a subagent, stop and say the review must run in a fresh session.
First line of the review file is exactly `VERDICT: PASS`, `VERDICT: FIX` or `VERDICT: ESCALATE`. Do not edit code in this stage.
