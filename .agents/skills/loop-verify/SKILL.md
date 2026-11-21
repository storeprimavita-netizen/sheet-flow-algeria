---
name: loop-verify
description: Loop stages 2 and 5 on the MNW project — independent review of a brief or of a task's diff, writing a verdict file docs/briefs/<id>.review-<n>.md. Use when asked to verify or review a task id or a brief path, and always before shipping high-risk or UI work.
---
Follow the body of `.claude/commands/verify.md` exactly, with these substitutions:
- Ignore its frontmatter (Claude Code settings).
- **High-risk or security review ("spawn the `qa-reviewer` agent") — in Codex**: run `scripts/review-high.sh <id>` (for a brief review `scripts/review-high.sh <id> brief`; for a re-check `scripts/review-high.sh <id> recheck "<the listed findings>"`), plainly, with no pipe or redirect; it can take 20 minutes. It asks Claude Opus through Claude Code. Its output is the findings; you write the review file from them, with `Reviewer model: claude-opus` on the second line. If its last line is `MODEL-USED: none`, start the `qa-reviewer` agent (`.codex/agents/`) with the brief path and the diff command instead, and write `Reviewer model: codex qa-reviewer`.
- **High-risk or security review — in Antigravity** runs on the model chosen for that job (`.agents/models.conf`, role `review-high`: Claude Opus 5.5 first, Gemini 4 Neon when the Opus limit is used up). Start it with:
  ```
  scripts/agy-run.sh run review-high --agent qa-reviewer --expect-text '^REVIEW-END:' -- "Review task <id>. Brief: docs/briefs/<id>.md. Diff: git diff v3...v3-<id>. <For a re-check: look only at these findings: …>. You are read-only. End your reply with the line: REVIEW-END: <h> high, <m> medium, <l> low"
  ```
  Its reply is the findings; you write the review file from them. The last line of the command output is `MODEL-USED: <id>` — put `Reviewer model: <id>` on the second line of the review file. If the command ends with `MODEL-USED: none`, start the `qa-reviewer` subagent from `.agents/agents/` instead and write `Reviewer model: session fallback`.
- **UI review ("spawn the `ui-reviewer` agent")** = start the `ui-reviewer` subagent (Antigravity: `.agents/agents/`; Codex: `.codex/agents/`) — it needs the browser. Give it the brief path and the diff command, never a conclusion.
- If both apply, run both and wait for both.
- The review must be done by an agent that did not write the code. If you built this task in this same conversation and can start neither the command above nor a subagent, stop and say the review must run in a fresh session.
First line of the review file is exactly `VERDICT: PASS`, `VERDICT: FIX` or `VERDICT: ESCALATE`. Do not edit code in this stage.
