# Night run with several programs (D101)

One script coordinates; each stage of a task is one fresh session on the program
and model chosen for that job. No model is spent on waiting or on deciding what
comes next. Programs: **Codex** (does most of the work), **Antigravity CLI**
(`agy`, Google — used as soon as it is installed and signed in), **Claude Code**
(last in line, first only for security reviews).

Gemini CLI is not in the list: since June 2026 Google serves Google AI Pro and
free accounts through the Antigravity CLI instead; Gemini CLI works only with a
paid API key or a company licence.

## Start

```
scripts/night.sh                 one run, in this Terminal window (leave it open)
scripts/night.sh codex "" 3      stop after 3 tasks
```
Before starting, close any Codex or Claude chat that is working in this folder —
one run per folder (a second `scripts/night.sh` with the same name refuses to
start). Files left uncommitted by a cut-off session are taken over only when
they sit on the branch of a task this run has claimed; otherwise the run asks
you to commit or set them aside first. The run continues by itself after a usage limit: it waits
until the time the program gives and goes on.

## Codex + Antigravity + Claude at the same time (D105)

```
scripts/night-workers.sh setup          once: creates the copies .worktrees/w2 and w3
scripts/night-workers.sh start          one run per program, all at once
tmux attach -t mnw                      watch them (Ctrl+B then 0/1/2 switches · Ctrl+B then D leaves them running)
scripts/night-workers.sh status | stop
```
| Run | Led by | Takes |
|---|---|---|
| main folder | Codex | every task, database changes included (the launch path) |
| copy w2 | Antigravity (`agy`) | tasks without a database change |
| copy w3 | Claude Code | tasks without a database change |

Each run writes briefs, builds and ships with its lead program, and its work is
reviewed by the other two (a program never reviews its own work first).
Questions go to Claude Fable whichever run raises them. Three programs are
three separate usage limits — that is the extra capacity; when one is at its
limit, that run waits for it, the other two keep going.
A program that is not installed or not signed in is skipped, not replaced:
until `agy` is installed (`curl -fsSL https://antigravity.google/cli/install.sh | bash`,
then run `agy` once to sign in, then `scripts/agy-setup.sh`), `start` runs Codex
and Claude only. Other mixes: `scripts/night-workers.sh start codex claude`.
Only one run at a time changes the local database, so the extra runs skip tasks
with a migration; most launch-path rows have one and stay with the main run.

## Who does what

`scripts/stage.sh models` prints the table as it resolves right now
(`STAGE_PREFER=claude scripts/stage.sh models` shows it for a run led by Claude).
The table below is the order for a single `scripts/night.sh` run. The file
is `.agents/stage-models.conf`: one line per job, first entry first, the next
one when a program is missing, at its limit or fails.

| Job | First choice | Then |
|---|---|---|
| Pick the task, write the brief | Codex GPT-6.2-Sol, medium | Antigravity Gemini 4 Neon · Claude Sonnet |
| Build, risk high | Codex GPT-6.2-Sol, high | Gemini 4 Neon · Claude Sonnet |
| Build, risk low | Codex GPT-6.2-Sol, medium | Gemini 4 Neon · Claude Sonnet |
| Build a small follow-up (no database change) | Codex GPT-6-Luna, medium | GPT-6.2-Sol when the gate fails · Gemini 4 Hydrogen · Claude Haiku |
| Review a screen | Codex GPT-6.1-Terra, medium | Gemini 4 Neon · Claude Sonnet |
| Review high-risk work | Codex GPT-6.2-Astra, high | Claude Opus · Gemini 4 Neon |
| Review a security surface (public form, webhook, tokens, permissions) | Claude Opus | Codex GPT-6.2-Astra · Gemini 4 Neon |
| Answer a question a task raised | Claude Fable | Codex GPT-6.2-Astra · Gemini 4 Neon |
| Final gate, progress note, merge | Codex GPT-6-Luna, low | GPT-6.2-Sol low · Gemini 4 Hydrogen · Claude Haiku |

Why: Codex charges per million tokens (input / output, in credits) Luna 2.5 /
12.5, Sol 50 / 250, Astra 200 / 1000. Luna does the mechanical work, Sol writes
the code, Astra only reads and judges (short sessions). To use Claude even less,
put the `codex` entry first on the `review-sec` line, or start with
`USE_CLAUDE=0 scripts/night.sh`.

## Why this replaces the night run inside a chat

Measured in Codex's own logs for 22–23 November 2026:
- the chat that coordinated a night re-sent its whole conversation on every
  call — 150,000 to 360,000 tokens each time — and 258 of the calls in one
  session were only "wait for the agent";
- the automatic approval reviewer ("Approve for me") was called about 1,450
  times on 23 November, almost always for a browser click or snapshot.
`scripts/night.sh` has neither: the coordinator is a script, and headless
sessions run with approvals off (what the command rules do not allow fails).
`$loop-night` in a chat still works when you want to watch a few tasks.

## The code map (graphify)

`graphify` is installed on this Mac (package `graphifyy` 0.9.119, isolated with
`uv`). The map is built from the code only — no model, no cost, nothing leaves
the Mac — in about 10 seconds: `GRAPHIFY_BACKEND=none graphify extract . --code-only`.
Agents ask it where things are instead of reading files (rule in AGENTS.md);
`scripts/night.sh` refreshes it after every task. Never run `/graphify .` inside
an agent: that form sends every document through a model.
Its real saving over a careful text search is not proven by independent tests;
it helps most for "where is X" and "what uses Y".

## What is tested

- The coordinator logic: 17 scenarios with stand-in stages (plain ship, review
  pass / fix / two rounds, follow-ups, high finding parked, design review,
  questions decided or sent to the owner, failed build, failed gate, failed
  ship, reviewer that writes nothing, usage-limit wait, end of the plan).
- One real minimal session through `scripts/stage.sh` on Codex and on Claude.
- NOT yet: a whole real task from pick to ship, and the Antigravity lane
  (`agy` is not installed). Watch the first task.
