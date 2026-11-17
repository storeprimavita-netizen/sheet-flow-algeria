---
name: loop-analyse
description: Loop stage 1 on the MNW project — claim the next task in docs/MASTER_PLAN.md and write its brief in docs/briefs/<id>.md. Use when asked to analyse, plan or brief a task id, or as the first step of the loop.
---
Follow the body of `.claude/commands/analyse.md` exactly, with these substitutions:
- Ignore its frontmatter (Claude Code settings).
- Claim the task as `claimed:antigravity` (not `claimed:claude`). Never take a task that is `claimed:` by anyone else.
- "$ARGUMENTS" is whatever followed the skill name.
Every step is committed and pushed with `scripts/step.sh "<id>: <what>"`. No feature code in this stage.
