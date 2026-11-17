---
trigger: always_on
---
# Antigravity on the MNW project

- The project rules are in `AGENTS.md` at the repository root. `CLAUDE.md` only adds Claude Code specifics; you do not need it.
- Work happens through the loop in `.claude/loop.md` (it applies to you too). Your entry points are the skills `loop-bootstrap`, `loop-analyse`, `loop-execute`, `loop-verify`, `loop-ship` and `loop-auto`. Setup notes: `docs/ANTIGRAVITY.md`.
- In `docs/MASTER_PLAN.md` you claim tasks as `claimed:antigravity`. Claude Code also works this plan; never touch a task claimed by another agent.
- Commit and push every finished step with `scripts/step.sh "<id>: <what>"`. Only branches `v3` and `v3-<id>`. Never `main`, never force-push, never `supabase db push`.
- `.claude/skills/impeccable`, `ui-ux-pro-max` and `frontend-design` are optional references — the design authorities are `cod-ui-polish` (app) and `luxe-modesty-store-theme` (store).
