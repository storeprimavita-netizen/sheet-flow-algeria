---
description: Run the loop automatically — Pick → Brief → Build → Gate → Review → Ship, repeated for N tasks or one id, until a stop condition
argument-hint: "[number of tasks | task id]  (default 1)"
---
You are the coordinator of loop v3 (`.claude/loop.md`). $ARGUMENTS is a task id (run that one), or a number N (run up to N tasks in plan order), default 1. You do not read code or write code yourself; you call the stage commands with the Skill tool, read only the first line or the ≤ 150-word return of each, and decide the next stage.

For each task:
1. `analyse [id]` → brief exists, task claimed. If it reports a missing owner input → stop condition.
2. If the brief says `risk: high` and its design is non-obvious (new table design, permission change, money formula, public endpoint): `verify docs/briefs/<id>.md`. On FIX, run `analyse <id>` again with the review file named; on ESCALATE → stop.
3. `execute <id>`. If the gate is not OK after its return, run `execute <id>` once more; the same failure twice → stop.
4. If the brief says risk high or names a surface: `verify <id>`. PASS → 5. FIX → `execute <id>` (it reads the review file) then `verify <id>` again. Third non-PASS, or ESCALATE → stop.
5. `ship <id>`. On any STOP from ship → stop.
6. Next task.

Parallel option: when the next two or three `todo` tasks have different lanes and none is lane `db`, you may run their stage-3 builds at the same time in separate worktrees (`.worktrees/<id>`); ship them one at a time.

Stop conditions are listed in `.claude/loop.md` — halt on any of them, never work around one. When you stop or finish, report in ≤ 10 lines: tasks shipped (id + merge commit), the task you stopped on and exactly what the owner must decide or provide, and what the next `/auto` will pick up.
