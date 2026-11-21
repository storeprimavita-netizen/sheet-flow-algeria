---
name: loop-auto
description: Run one task of the MNW development loop end to end — pick, brief, build, gate, review, ship — then stop. Use when asked to "run the loop", "do the next task", "continue the plan" or "/loop-auto"; scripts/agy-night.sh calls it once per fresh session.
---
You coordinate loop v3 for this project. The loop is defined in `.claude/loop.md` and the exact stage order and rules in `.claude/commands/auto.md` — read both first; they apply to every agent, not only Claude Code. Ignore the frontmatter of the files under `.claude/commands/` (those are Claude Code settings).

Arguments (any order, all optional): a task id (do that one) · `nodb` (pick only rows with no migration: column `M` is `–`) · `as:<name>` (claim rows as `claimed:<name>`; default `claimed:antigravity`) · a number (ignored: one task per session).

Run the stages as skills, in order: `loop-analyse` → `loop-verify` on the brief only when it is high risk and the design is non-obvious → `loop-execute` → `loop-verify` on the diff when the brief says risk high or names a surface (at most 2 rounds; a re-check looks only at the listed findings) → `loop-ship`.

Rules that matter most:
- One task per session. When it is shipped or parked, write the short run report and stop.
- Take only `todo` rows. Claim under your name and push the claim before building; if the push is rejected, pull and pick another row. Never touch a row claimed by another name — Claude Code and other Antigravity agents work the same plan.
- Commit and push every finished step with `scripts/step.sh "<id>: <what>"`. Only branches `v3` and `v3-<id>`. Never `main`, never force-push, never `supabase db push`.
- `scripts/gate.sh` decides whether work is done. Never edit the gate or the reviewers, never delete a test to pass.
- Reviews are never done by the agent that wrote the code. `loop-verify` sends a high-risk or security review to the model chosen for it (`scripts/agy-run.sh run review-high` — Claude Opus 5.5, then Gemini 4 Neon) and a UI review to the `ui-reviewer` subagent.
- Model per job is in `.agents/models.conf` (D95); never hard-code a model name anywhere else.
- A question never stops the run: use `loop-decide` and continue. Low findings go to `docs/BACKLOG.md`, mediums to ONE follow-up row.
- Hard limits, never worked around: credentials and secrets, anything touching `main`, remote database or production deploy, real parcels / customer messages / ad events, spending money, deleting data.

The very last line of your reply is exactly one of: `RUN-END: more` (other tasks are still eligible), `RUN-END: nothing-eligible` (every remaining task waits on the owner or on a parked task), `RUN-END: hard-stop <reason>`.
