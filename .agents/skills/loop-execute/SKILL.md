---
name: loop-execute
description: Loop stage 3 on the MNW project — implement docs/briefs/<id>.md on branch v3-<id>, pushing each step and running scripts/gate.sh. Use when asked to build, implement or execute a task id that already has a brief.
---
Follow the body of `.claude/commands/execute.md` exactly, with these substitutions:
- Ignore its frontmatter (Claude Code settings).
- Skills named there are in `.agents/skills/` (`karpathy-guidelines`, `mnw-codebase-hygiene`, `modern-web-guidance` before any HTML/CSS/client JS, `cod-ui-polish` for app UI, `luxe-modesty-store-theme` for store UI). `ponytail` is a Claude Code plugin — skip it.
- Only work a task whose plan status is your own claim (`claimed:codex`, `claimed:antigravity`, or the `as:<name>` you were given). The name is the run's, not the program's: started with `as:w2-agy` you ARE `w2-agy`; and in a copy under `.worktrees/w<N>` the run's claim name starts with the folder name (`w2-agy` in `.worktrees/w2`, `w3-claude` in `.worktrees/w3`). That claim is yours, whichever program you are (D107, D109) — build the task, never ask to rename or move the claim.
`scripts/gate.sh` decides whether the work is done; never edit it, the reviewers, or delete a test to pass it. Do not merge.
