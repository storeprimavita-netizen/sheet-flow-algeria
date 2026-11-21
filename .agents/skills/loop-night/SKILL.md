---
name: loop-night
description: Keep building the MNW plan task after task inside this Antigravity session, visibly, until nothing is left that can run without the owner. Use when asked for "/loop-night", "night run", "keep going", "run all night", "continue until done". Arguments - optional `nodb`, `as:<name>`, a maximum number of tasks.
---
You are the night coordinator. You stay in this conversation and the owner watches it, so everything you print must be short and readable. You do not read or write code yourself.

Arguments (all optional, any order): a number = stop after that many tasks (default: no limit) · `nodb` = only tasks without a migration · `as:<name>` = claim name (default `antigravity`).

Before the first task, once:
1. `git checkout v3 && git pull --rebase`, then `scripts/dev-up.sh` — print its lines.
2. Run `scripts/agy-run.sh models` and print its lines — the owner sees which model does which job tonight (`.agents/models.conf`).
3. Print: `NIGHT RUN started · claim name <name> · <filter or "all tasks">`.
4. `scripts/notify.sh "Night run started (<name>)"`.
5. Set a wake-up with the schedule tool: recurring, every 30 minutes, kept alive after the current task (daemon), prompt `Night run check: if you are idle and the night run has not ended, continue it with the next task.` It brings the run back when a turn ended early, for example after a usage limit reset. Cancel it when the run ends.

Then repeat:
1. Start the **`task-runner`** subagent with exactly: `Run one task: <nodb if set> as:<name>`. One subagent per task, so every task gets a fresh context. Wait for it.
2. Its reply ends with a `RESULT:` line and a `RUN-END:` line. Print one line for the owner, for example:
   `✔ 22:41  STORE-4 shipped (merge 3fa9c1e) · 37 min` or `■ 23:10  CONF-2 parked — <reason>`.
   Send the same line with `scripts/notify.sh "<line>"`.
3. `RUN-END: more` → next task. `RUN-END: nothing-eligible` → stop. `RUN-END: hard-stop …` → stop.
4. If a subagent returns without a `RUN-END:` line (crash, timeout): print what you know, run `git status -sb` and `git stash push -u -m "night leftovers"` if the tree is dirty, `git checkout v3`, and continue with the next task. Three such failures in a row → stop.
5. Every 5 tasks print a two-line summary: shipped so far, parked so far.

When you stop: print a short report whose last line is `NIGHT RUN ended · <why>` — tasks shipped (id + merge commit), tasks parked and why, what waits on the owner (`docs/QUESTIONS.md`, the "Owner inputs" table in `docs/MASTER_PLAN.md`), and what the next `/loop-night` will pick up. Cancel the wake-up schedule, run `scripts/dev-down.sh` so the dev server does not keep the Mac hot, and `scripts/notify.sh "Night run ended: <n> shipped, <m> parked — <why it ended>"`.

Rules:
- Never work around a hard limit: credentials and secrets, anything touching `main`, remote database or production deploy, real parcels / customer messages / ad events, spending money, deleting data.
- Do not start a second task-runner while one is working in this folder. For parallel agents the owner opens another terminal in a separate copy (`scripts/agy-parallel.sh setup`) and runs `/loop-night nodb as:agy-2` there.
- If the session model's usage limit stops you, Antigravity does not switch model by itself. The wake-up schedule tries again every 30 minutes; if that does not bring the run back, the owner picks another model with `/model` (next in the `lead` row of `.agents/models.conf`) and types `/loop-night` again — it continues from the plan, every finished step is already pushed.
- You never review or decide yourself: `loop-verify` and `loop-decide` send that work to the model chosen for it through `scripts/agy-run.sh`.
