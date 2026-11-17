---
name: loop-ship
description: Loop stage 6 on the MNW project — final gate, PROGRESS block, plan tick, merge v3-<id> into v3 and push. Use when asked to ship or merge a task id that has passed review or is low risk.
---
Follow the body of `.claude/commands/ship.md` exactly (ignore its frontmatter). Never push or merge to `main`, never force-push, never run `supabase db push`. If any precondition fails, stop and report — do not work around it.
