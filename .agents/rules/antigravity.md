---
trigger: always_on
---
# Antigravity on the MNW project

- The project rules are in `AGENTS.md` at the repository root. `CLAUDE.md` only adds Claude Code specifics; you do not need it.
- Work happens through the loop in `.claude/loop.md` (it applies to you too). Your entry points are the skills `loop-bootstrap`, `loop-analyse`, `loop-execute`, `loop-verify`, `loop-decide`, `loop-ship`, `loop-auto` (one task) and `loop-night` (task after task, in this session). Setup and parallel-agent notes: `docs/ANTIGRAVITY.md`.
- In `docs/MASTER_PLAN.md` you claim tasks under your own name (`claimed:antigravity`, or the `as:<name>` you were started with). Other agents work this plan at the same time; never touch a task claimed by another name.
- If you were started with `nodb`, you never write a migration, never run `scripts/db-reset.sh`, and never take a row whose `M` column is not `–`: another agent owns the local database.
- Start the app only with `scripts/dev-up.sh` (never `npm run dev` / `next dev` yourself) and run `scripts/dev-down.sh` when your work in this session is done — a dev server left running once used 8 cores for an hour.
- Use the app URL that `scripts/dev-up.sh` prints (your working copy may run on its own port).
- Commit and push every finished step with `scripts/step.sh "<id>: <what>"`. Only branches `v3` and `v3-<id>`. Never `main`, never force-push, never `supabase db push`.
- Design authorities: `cod-ui-polish` (back-office app) and `luxe-modesty-store-theme` (public store); `modern-web-guidance` before HTML/CSS/client JS; `supabase` and `supabase-postgres-best-practices` for database work. Never run `migrate-radix-to-base`.
- Which model does which job is in `.agents/models.conf`; stages that need a particular model go through `scripts/agy-run.sh` (it falls back to the next model when one is out of quota). Do not pass `--model` yourself.
- Keep your own messages short; put detail in files (`docs/briefs/<id>.md`, review files), not in the conversation.
