---
description: Run the loop automatically — Pick → Brief → Build → Gate → Review → Ship, repeated for N tasks or one id, until the plan runs dry or a hard stop
argument-hint: "[number of tasks | task id]  (default 1)"
---
You are the coordinator of loop v3 (`.claude/loop.md`). $ARGUMENTS is a task id (run that one), or a number N (ship up to N tasks in plan order), default 1. You do not read code or write code yourself; you call the stage commands with the Skill tool, read only the first line or the ≤ 150-word return of each, and decide the next stage.

Before the first task: run `scripts/dev-up.sh` once and note which parts are up. If Supabase is down, only tasks that do not touch the database may run (D24); if the app is down, no `ui` task may run.

Pick: the first `todo` row in docs/MASTER_PLAN.md, top to bottom, whose deps are all `done` and whose owner inputs are all `closed`. Rows waiting on an open owner input or on a `blocked` task are skipped, not stopped on.

For each task:
1. `analyse [id]` → brief exists, task claimed.
2. If the brief says `risk: high` and its design is non-obvious (new table design, permission change, money formula, public endpoint): `verify docs/briefs/<id>.md`. On FIX, run `analyse <id>` again with the review file named.
3. `execute <id>`. If the gate is not OK after its return, run `execute <id>` once more.
4. If the brief says risk high or names a surface: `verify <id>`. PASS → 5. FIX → `execute <id>` (it reads the review file) then `verify <id>` again.
5. `ship <id>`.
6. Next task.

**A task that cannot finish does not end the run.** When one task hits a task-level stop — its brief needs a new owner decision, ESCALATE, a third review without PASS, the same gate failure twice, a merge conflict at ship — set its plan status to `blocked:<short reason>` on `v3` (`scripts/step.sh "<id>: blocked — <reason>"`), leave its branch pushed and unmerged, and pick the next eligible task. Tasks that depend on it are skipped.

**Hard stops end the run immediately:** a push that keeps failing, a secret-scan hit, anything that would touch `main`, a remote `db push` or production deploy being required, the local stack going down mid-run, three tasks in a row ending `blocked`, or no eligible task left. Never work around a stop condition in `.claude/loop.md`.

Parallel option: when the next two or three eligible tasks have different lanes and at most one has a migration (`M`), you may run their stage-3 builds at the same time in separate worktrees (`.worktrees/<id>`); ship them one at a time.

When you stop or finish, append a "Run report" block to PROGRESS.md (≤ 10 lines, committed with `scripts/step.sh`) and reply with the same: tasks shipped (id + merge commit), tasks left `blocked` and exactly what the owner must decide or provide for each, why the run ended, and what the next `/auto` will pick up.
