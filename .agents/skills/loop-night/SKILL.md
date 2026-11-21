---
name: loop-night
description: Night run of the MNW plan - keep building task after task inside this chat, visibly, until nothing is left that can run without the owner. Works in the Codex app and in Antigravity. Use when asked for "$loop-night", "/loop-night", "night run", "start the night run", "keep going", "run all night", "continue until done". Arguments - optional `nodb`, `as:<name>`, a maximum number of tasks.
---
If you are **Codex** (desktop app or CLI), follow "In Codex". If you are **Antigravity**, follow "In Antigravity". The two never mix.

# In Codex

You are the night coordinator of this chat. The owner reads it, so print one short line per event and nothing else. You do not read or write code yourself: every stage runs in a fresh subagent, so this chat stays small over many tasks.

Arguments (all optional, any order): a number = stop after that many tasks (default: no limit) · `nodb` = only tasks without a migration (column `M` is `–`) · `as:<name>` = claim name (default `codex`).

## Before the first task

Stop with the given line if a check fails — do not try to repair it yourself.
1. Your instructions must contain the check word `MNW-CODEX-SETTINGS-LOADED`. If they do not, the project settings in `.codex/` are not loaded and the command rules are off. Print `NIGHT RUN not started · project settings not loaded — in Terminal run scripts/codex-setup.sh --trust, restart the app, start again` and stop.
2. Run `git rev-parse --show-toplevel` and `git branch --show-current`. If the folder is inside a `worktrees` folder or no branch is printed, print `NIGHT RUN not started · this chat runs in a worktree — start a new chat in Local mode (work directly in the project folder)` and stop.
3. `git checkout v3`, then `git pull --rebase` (two separate calls). Then `scripts/dev-up.sh` and print its lines. Supabase down → only tasks without a migration may run; app down → no `ui` task.
4. `date +%s > .night-run` — this file tells the project's stop hook that a night run is on (git ignores it).
5. If you have a tool that schedules tasks in this chat, schedule one: every 30 minutes, prompt `Night run check: if the file .night-run exists and you are idle, continue $loop-night with the next task.` It brings the run back after a usage limit. No such tool → skip this step without comment.
6. Print `NIGHT RUN started · claim name <name> · <filter or "all tasks">` and run `scripts/notify.sh "Night run started (<name>)"`.

## Each task

Read `.claude/commands/auto.md` once (ignore its frontmatter): it gives the order of the stages, when a review is needed, the two-round limit, what to do with questions, failed tasks and follow-ups, and the hard stops. Everything there applies, except: you do not end after one task, and where it calls a stage command you do this instead:

| Stage | How |
|---|---|
| Brief | start the **`stage-runner`** agent with `Use the loop-analyse skill. Arguments: <id if you were given one> <nodb if set> as:<name>` |
| Review of a high-risk brief with a non-obvious design | do the `loop-verify` skill **yourself** on `docs/briefs/<id>.md` |
| Build (after `scripts/db-reset.sh` when the task has a migration) | `stage-runner`: `Use the loop-execute skill. Arguments: <id>` — once more if the gate is not OK |
| Review of the build, when the brief says risk high or names a surface | do the `loop-verify` skill **yourself** (`scripts/review-high.sh <id>` for high risk or security, the `ui-reviewer` agent for UI; you write the review file and push it) |
| Fix after a review | `stage-runner`: `Use the loop-execute skill. Arguments: <id>` (it reads the review file), then `loop-verify` again as a re-check |
| A question the task raised | start the **`decider`** agent (stronger model) with `Use the loop-decide skill. Arguments: <id> <the question, or the file that raised it>` — if it cannot be started, `stage-runner` with the same prompt |
| Ship | `stage-runner`: `Use the loop-ship skill. Arguments: <id>` |

Why you run `loop-verify` yourself: it starts the reviewers, and an agent started by you may not be able to start another one. You never built the code, so the rule "the reviewer did not write it" holds.

Never pass a model name when you start an agent: each agent file under `.codex/agents/` carries its own model (D96). One `stage-runner` at a time; wait for its reply; read only its short reply, never ask it for logs. If a reply starts with `STAGE FAILED`, or an agent returns nothing, treat it as a technical failure of that task (`auto.md`: set the row to `blocked:<short reason>` on `v3` with `scripts/step.sh`, leave the branch pushed, next task). If the tree is dirty afterwards: `git stash push -u -m "night leftovers"`, `git checkout v3`.

After each task print one line and send the same line with `scripts/notify.sh "<line>"`, for example
`✔ 22:41  STORE-4 shipped (merge 3fa9c1e) · 37 min` or `■ 23:10  CONF-2 parked — <reason>`.
Every 5 tasks print two lines: shipped so far, parked so far. Then start the next task — do not wait for the owner and do not ask whether to continue.

## When the run ends

It ends when: no task is eligible (every remaining one waits on the owner or on a parked task) · the maximum number of tasks is reached · a hard stop from `auto.md` · three tasks in a row failed for technical reasons.

Then: append the "Run report" block to `PROGRESS.md` and push it (`scripts/step.sh "night run report"`); remove the schedule from step 5 if you made one; `rm -f .night-run`; `scripts/dev-down.sh`; `scripts/notify.sh "Night run ended: <n> shipped, <m> parked — <why>"`. Print the report: tasks shipped (id + merge commit), tasks parked and why, decisions taken (D-numbers), what waits on the owner (`docs/QUESTIONS.md`, the "Owner inputs" table in `docs/MASTER_PLAN.md`), what the next `$loop-night` will pick up. Its last line is exactly `NIGHT RUN ended · <why>`.

## Rules

- Never work around a hard limit: credentials and secrets, anything touching `main`, remote database or production deploy, real parcels / customer messages / ad events, spending money, deleting data. A blocked command is a rule, not an obstacle.
- A question never stops the run and is never put to the owner in this chat: `loop-decide` records it, the run goes on with other tasks.
- If this chat is told "The night run is still on" after you stopped, that is the stop hook: continue with the next task, or end the run properly as described above.
- If a usage limit stops the chat, nothing is lost — every finished step is pushed. When the owner types `$loop-night` again, start from "Before the first task"; rows still marked `claimed:<name>` with a pushed branch `v3-<id>` are yours to continue before picking a new one.
- If the owner writes anything that means stop or pause ("stop", "stop the night run", "enough"): first `rm -f .night-run`, finish nothing new, run `scripts/dev-down.sh`, and answer with a two-line state (task in progress and its branch) ending with `NIGHT RUN ended · stopped by the owner`.
- If you cannot start the `stage-runner` agent (no tool to start agents, or it fails twice in a row for that reason and not because of the task), run each stage yourself with its skill instead and say so once: `stage agents unavailable — running stages in this chat`.
- Do not start a second night run in this folder. A second agent needs its own copy of the project and runs with `nodb`.

# In Antigravity

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
