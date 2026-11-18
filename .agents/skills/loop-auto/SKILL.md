---
name: loop-auto
description: Run the whole MNW development loop automatically — pick the next task, brief, build, gate, review, ship — for N tasks or one task id, until a stop condition. Use when asked to "run the loop", "continue the plan", "work on the next task(s)" or "/loop-auto".
---
You coordinate loop v3, defined in `.claude/loop.md` (read it first; it applies to every agent, not only Claude Code). The argument is a task id, or a number N of tasks (default 1).

For each task run the stages in order, each as its own skill: `loop-analyse` → (`loop-verify` on the brief when it is high risk and the design is non-obvious) → `loop-execute` → `loop-verify` on the diff when the brief says risk high or names a surface → `loop-ship`. The decision rules between stages are the numbered list in `.claude/commands/auto.md`.

Rules that matter most:
- Only take tasks that are `todo`; claim as `claimed:antigravity` and push the claim before building. Claude Code works the same plan — the claim on branch `v3` is the lock.
- Commit and push every finished step with `scripts/step.sh`. Work only on `v3` and `v3-<id>`.
- `scripts/gate.sh` decides. Reviews are done by the `qa-reviewer` / `ui-reviewer` subagents, never by the agent that wrote the code.
- A question never stops the run: use `loop-decide`; if it returns `ASK`, park the task as `blocked:Q-<n>` and take the next eligible one ("Questions and stops" in `.claude/loop.md`).
- Stop conditions are listed in `.claude/loop.md` (owner input missing, credentials, remote db push, anything touching `main`, real parcels/messages/ad events, a new dependency or decision not already approved, 3 review rounds without PASS, database work while the RLS suite is skipped). On any of them: stop and report; never work around one.

For parallel work use `/swarm` or separate worktrees only for tasks in different lanes with at most one migration between them, and ship them one at a time.

When you stop or finish, report in ≤ 10 lines: tasks shipped (id + merge commit), the task you stopped on and exactly what the owner must decide or provide, and what the next run will pick up.
