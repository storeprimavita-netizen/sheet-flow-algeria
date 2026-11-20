---
model: sonnet
effort: medium
description: Run the loop automatically — Pick → Brief → Build → Gate → Review → Ship, repeated for N tasks or one id; questions are decided or sent to the owner without stopping other work
argument-hint: "[number of tasks | task id | all]  (default 1)"
---
You are the coordinator of loop v3 (`.claude/loop.md`). $ARGUMENTS is a task id (run that one), a number N (ship up to N tasks in plan order), or `all` (keep going until no task is eligible); default 1. You do not read code or write code yourself; you call the stage commands with the Skill tool, read only the first line or the ≤ 150-word return of each, and decide the next stage.

**One task per session (D90).** Whatever number was passed, this session ships (or parks) **one** task, writes its short report and ends with `RUN-END: more` if anything is still eligible. `scripts/night-run.sh` starts a fresh session for the next task, so no session carries another task's context. Do not `/compact`; end instead. Keep your own messages short and never paste a stage's output back.

**Start of run.** `git checkout v3 && git pull --rebase`. Run `scripts/dev-up.sh` and note which parts are up: Supabase down → only tasks that do not touch the database may run (D24); app down → no `ui` task. Read `docs/QUESTIONS.md`: for every question the owner has answered (in the file or in this conversation), record it as a DECISIONS row, move it to "Answered", and set its task back to `todo`.

**Worker options (parallel agents).** $ARGUMENTS may also contain `nodb` — pick only rows with no migration (column `M` is `–`), because only one agent at a time may change the database — and `as:<name>` — claim rows as `claimed:<name>` instead of `claimed:claude`. A row claimed by another name is never touched.

**Pick.** The first `todo` row in docs/MASTER_PLAN.md, top to bottom, whose deps are all `done` and whose owner inputs are all `closed`. Rows waiting on an open owner input, an open question or a `blocked` task are skipped, not stopped on.

**For each task:**
1. `analyse [id]` → brief exists, task claimed.
2. If the brief says `risk: high` and its design is non-obvious (new table design, permission change, money formula, public endpoint): `verify docs/briefs/<id>.md`. On FIX, run `analyse <id>` again with the review file named.
3. If the task has a migration (`M`): `scripts/db-reset.sh` first, so the local database matches `v3`. Then `execute <id>`. If the gate is not OK after its return, run `execute <id>` once more.
4. If the brief says risk high or names a surface: `verify <id>`. PASS → 5. FIX → `execute <id>` (it reads the review file) then `verify <id> recheck` — the reviewer re-checks only the listed findings and the lines the fix touched, not the whole task. **At most 2 review rounds** (D90); a 3rd only when round 2 still has a high finding. After that: no high → ship, mediums into ONE follow-up row, lows into `docs/BACKLOG.md`; a high still open → park the task.
5. `ship <id>`.
6. Next task.

**When a task raises a question** (the brief or a review says the owner must decide, ESCALATE, a new DECISIONS row is needed): do not stop. Run `decide <id> <question or file>`.
- `DECIDED:` → continue the same task from the stage that raised it (`analyse <id>` if the brief must change, else `execute <id>`).
- `ASK:` → send the question to the owner's phone with the PushNotification tool (load it with ToolSearch if it is deferred; one line, under 200 characters, question + recommended answer). Set the task to `blocked:Q-<n>` on `v3` (`scripts/step.sh`), leave its branch pushed, and **pick the next eligible task** — other work never waits for an answer.

**When a task fails for a technical reason** (same gate failure twice, review rounds exhausted, merge conflict at ship): set it to `blocked:<short reason>`, leave its branch pushed and unmerged, and pick the next eligible task. If that branch carries a migration, run `scripts/db-reset.sh` on `v3` before the next task.

**When no eligible task is left but questions are open:** send one PushNotification ("N questions waiting — …"), then ask the owner with AskUserQuestion (up to 4 questions at a time, recommended option first) and wait. On answers: record each as a DECISIONS row, update `docs/QUESTIONS.md`, set the tasks back to `todo`, and continue the run. If AskUserQuestion is not available (headless run), end the run with the report instead.

**Hard stops end the run immediately:** a push that keeps failing, a secret-scan hit, anything that would touch `main`, a remote `db push` or production deploy being required, or the local stack going down and `scripts/dev-up.sh` failing to bring it back. Never work around a stop condition in `.claude/loop.md`.

**Three tasks in a row parked for technical reasons** is not a hard stop: end this batch with its report and `RUN-END: more` if other tasks are still eligible (a fresh session starts the next batch), or `RUN-END: nothing-eligible` if not.

Parallel option: when the next two or three eligible tasks have different lanes and none has a migration (`M`), you may run their stage-3 builds at the same time in separate worktrees (`.worktrees/<id>`); ship them one at a time.

**Follow-ups and merging without the owner (D40, D89).** When a task's review rounds run out with gate OK and no high finding: ship it. Never park a task as "merge needs owner OK". Open medium findings → ONE follow-up row for that task. Low findings → append to `docs/BACKLOG.md` (task id · file · one line), never a new row. A follow-up row never gets a follow-up of its own: what it leaves open goes to the backlog. Feature rows are picked before follow-up rows when both are eligible.

**Phone notice.** When the task is shipped or parked, run `scripts/notify.sh "<task id> shipped|parked — <≤ 12 words>"` (it does nothing if the owner has not set a channel).

**End of run.** Append a "Run report" block to PROGRESS.md (≤ 10 lines, committed with `scripts/step.sh`) and reply with the same: tasks shipped (id + merge commit), decisions Claude took (D-numbers, one line each — the owner may overturn them), questions still open, tasks left blocked and why, and what the next `/auto` will pick up. Send one PushNotification with the one-line result.

The very last line of your reply is exactly one of: `RUN-END: more` (eligible tasks remain — the batch size was reached), `RUN-END: nothing-eligible` (every remaining task waits on the owner or on a parked task), or `RUN-END: hard-stop <reason>`. `scripts/night-run.sh` reads this line to decide whether to start the next batch.
