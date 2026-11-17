---
name: loop-execute
description: Loop stage 3 on the MNW project — implement docs/briefs/<id>.md on branch v3-<id>, pushing each step and running scripts/gate.sh. Use when asked to build, implement or execute a task id that already has a brief.
---
Follow the body of `.claude/commands/execute.md` exactly, with these substitutions:
- Ignore its frontmatter (Claude Code settings).
- Skills named there are in `.agents/skills/` (`karpathy-guidelines`, `mnw-codebase-hygiene`, `cod-ui-polish` for app UI, `luxe-modesty-store-theme` for store UI). `ponytail` is a Claude Code plugin — skip it.
- Only work a task whose plan status is `claimed:antigravity`.
`scripts/gate.sh` decides whether the work is done; never edit it, the reviewers, or delete a test to pass it. Do not merge.
