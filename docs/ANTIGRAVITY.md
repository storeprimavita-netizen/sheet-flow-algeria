# Continuing this project with Google Antigravity CLI (`agy`)

Antigravity works the same plan, the same loop and the same skills as Claude
Code. Shared state is git: plan, specs, briefs and reviews on branch `v3`.

> **Status (2026-11-21): `agy` 1.5.13 is installed; its saved state and sign-in
> were cleared on the owner's request, so sign in again. No task has been built
> with it yet.** The model routing below was tested only with a stand-in for
> `agy`, because Gemini 4 and Opus 5.5 were locked on the account that day.
> Facts come from antigravity.google/docs, re-read 2026-11-21.

## Gemini CLI or Antigravity CLI?

Use **Antigravity CLI (`agy`)**. Gemini CLI stopped serving Google AI Pro,
Ultra and free accounts on 2026-06-18; it only works with paid API keys now.
`agy` is its replacement and is what a Google AI Pro subscription covers.

## Models and who does what (D95)

What Google AI Pro gets in Antigravity (antigravity.google/docs/models):

| Model | Google AI Pro |
|---|---|
| Gemini 4 Neon, Gemini 4 Argon, Orchestrator | paid Pro (or a trial that came with an eligible device) |
| Gemini 4 Hydrogen, Claude Opus 5.5, Claude Sonnet 5.5 | paid Pro only — **not during a free trial** |
| Gemini 4 Carbon | Ultra only |
| Gemini 3.8 Flash | every plan |
| Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS 120B | every plan, **removed on 30 November 2026** |

If the picker shows a model as "Unavailable · available to paid Pro and Ultra
subscribers", the subscription is still in its trial or has not reached
Antigravity yet. Nothing in the repo needs changing when it unlocks.

Which model does which job is one file, `.agents/models.conf`:

| Job | First choice | Then |
|---|---|---|
| `lead` — the session running `/loop-night`, planning (Fable's part in Claude Code) | Orchestrator (Neon): Neon plans, Hydrogen edits | Gemini 4 Neon → Argon → Opus 4.6 → Flash |
| `decide` — answering a question a task raised (Fable's part) | Gemini 4 Neon (High) | Argon → Opus 4.6 → Flash |
| `review-high` — review of high-risk and security work | **Claude Opus 5.5** | Gemini 4 Neon → Argon → Opus 4.6 → Flash |
| `task` — a whole task per session (`scripts/agy-night.sh` only) | Orchestrator (Neon) | Orchestrator (Argon) → Neon → Argon → Hydrogen → Flash |

`scripts/agy-run.sh models` prints what each job resolves to on your account
right now. A model that is locked is skipped; a model that fails during a run
(usage limit reached) is replaced by the next one in its row — that is how
"Opus 5.5 until its limit ends, then Gemini" works. Antigravity itself has no
automatic switch: for the session's own model you change it with `/model`.

## 1. Install and sign in (once)

```
curl -fsSL https://antigravity.google/cli/install.sh | bash
```
Open a **new** Terminal window, then:
```
cd ~/Documents/Projects/sheet-flow-algeria
agy --version
agy                      # opens the app in the terminal; sign in with your Google AI Pro account
```
Inside it: `/model` → choose **Orchestrator (Neon)** (or Gemini 4 Neon). While those are
locked, choose Gemini 3.8 Flash (High). The choice is remembered.

## 2. Check the project is seen

```
scripts/agy-setup.sh
```
It prints the installed version, the models your account can use, and the
rules, skills and reviewers this project gives Antigravity. Inside `agy`, type
`/skills reload` and ask: "which rules, skills and subagents do you see for
this project?" — you should get the `loop-*` skills, the shared skills and the
two reviewers. If shared skills are missing, your build does not follow
symlinks: run `scripts/sync-agent-skills.sh --copy`.

## 3. Permissions (needed before any unattended run)

Without a prompt to answer, `agy` quietly refuses anything it is not allowed to
do and still reports success. Give it the project's rules once:

```
scripts/agy-setup.sh --write-permissions
```
This adds the rules to `~/.gemini/antigravity-cli/settings.json` (the file is
backed up and its other settings are kept): git, the project's scripts, tests
and builds are allowed; force push, pushing to `main`, the real database,
`sudo` and starting the dev server directly are denied; everything else asks.
Check with `/permissions` inside `agy`. If `agy` shows a "Settings Error",
restore the backup.

Mode: `agy` starts in `auto` mode on a personal account (edits in the project
are approved, safe commands run in its sandbox, risky ones still ask). Keep it.

## 4. First task by hand

```
agy
> /loop-bootstrap          where are we
> /loop-auto 1             one task, end to end
```
Watch it claim a task, write the brief, build, run `scripts/gate.sh`, review
and merge into `v3`. If it stops to ask permission for something harmless that
it will need every time, add it to the allow list.

## 5. The night run — a command inside `agy`

```
agy
> /loop-night
```
It stays in the session in front of you: which model does which job, one line
per finished task, a short summary every five tasks, a report at the end. Each
task is handed to a fresh `task-runner` subagent, so the session stays small.

```
> /loop-night 5            stop after five tasks
> /loop-night nodb         only tasks that do not change the database
```
Stronger variant, using Antigravity's own goal mode (it refuses to end the turn
until the goal is met, with no step limit):
```
> /goal Run the loop-night skill and keep going until it prints "NIGHT RUN ended" with the reason; do not stop between tasks.
```
Stop either one by typing `stop the night run` (or `Esc`).

Useful while it runs: `/usage` shows your limit bars, `/agents` shows the
subagent that is working, `/tasks` shows the wake-up schedule.

Keep the Mac awake: in another Terminal window, `caffeinate -ims` (leave it
open). Lid closed: `sudo pmset -a disablesleep 1`.

**When a usage limit is reached.** Reviews and decisions switch model by
themselves (table above). The session's own model does not: the run sets a
wake-up every 30 minutes that continues it when the limit has refreshed; if
that does not bring it back, pick the next model with `/model` and type
`/loop-night` again. Nothing is lost — every finished step is pushed.
`scripts/agy-night.sh` (plain Terminal, less to see) switches model and waits
by itself.

### Following it from your phone

- **Remote Control** (built into `agy`): type `/remote-control on` in the
  session. It prints a link; open it on the phone signed in with the same
  Google account. You see the output live and can answer its questions or type
  to it. It works only while the Mac is awake and online, and only if Google
  has enabled it for your account.
- **GitHub** (nothing to set up): the `v3` commit list shows each finished step
  within seconds; `PROGRESS.md` shows what shipped.
- **Notifications** (two minutes to set up): install the free **ntfy** app,
  subscribe to a topic name only you know (long and random, it works like a
  password), and add one line to `.env.local`:
  `NOTIFY_NTFY_TOPIC=<that-name>`. The run then sends one line per task
  shipped or parked, and when it starts and ends. Test it:
  `scripts/notify.sh "hello"`. A Telegram bot works too
  (`NOTIFY_TELEGRAM_TOKEN`, `NOTIFY_TELEGRAM_CHAT`).
- Only task ids and one-line results are sent, never customer data.

## 6. Parallel agents

```
scripts/agy-parallel.sh setup 2          # creates .worktrees/agy-2 and agy-3 (full copies, own ports)
```
Then one Terminal window per agent:
```
window 1:  agy                                    then  /loop-night                    # main agent, database tasks allowed
window 2:  cd .worktrees/agy-2 && APP_PORT=3001 agy    then  /loop-night nodb as:agy-2
window 3:  cd .worktrees/agy-3 && APP_PORT=3002 agy    then  /loop-night nodb as:agy-3
```
`scripts/agy-parallel.sh status` shows what each one is on; `remove` deletes the
extra copies when you are done.

How they stay apart: each agent claims its task on `v3` and pushes the claim
before building, so two agents never take the same one. Only the main agent
takes tasks with a database migration; the others take the rest (`nodb`) and
skip the live database tests, which the main agent runs on every merge.

Honest limits: the three agents share one local database and one usage limit.
When the main agent resets the database, the others' app pages error for about
a minute. Start with **two** agents and add the third only if it goes well.
Three agents do not triple the speed: many remaining tasks have migrations and
only the main agent can take those.

Other ways to parallelise inside Antigravity: `/swarm <task>` (all plans:
coordinator + workers + verifier on one broad task; "uses quota much faster
than a single conversation"), `/boost <task>` (paid plans: deep reasoning on
one hard bug) and `/teamwork` (paid plans). They are not part of the loop —
use them by hand for a single large task. In the
Antigravity App, start each agent in "New Worktree mode".

## Claude Code and Antigravity together

Both can work the plan at the same time under the same claim rule. A good
split is one builds and the other reviews: `/loop-verify <id>` in Antigravity
on a task Claude built, or `/verify <id>` in Claude Code on an Antigravity task
— a different model family catches different mistakes. Never run two agents in
the **same folder** at once.

## What is in the repo for Antigravity

| Path | What |
|---|---|
| `AGENTS.md` | Project conventions (shared with Claude Code) — always loaded |
| `.agents/rules/antigravity.md` | Always-on rules: claim names, `nodb`, never `main` |
| `.agents/skills/loop-*` | The loop: bootstrap, analyse, execute, verify, decide, ship, auto (one task), **night** (task after task) |
| `.agents/skills/<shared>` | `cod-ui-polish`, `luxe-modesty-store-theme`, `modern-web-guidance`, `mnw-codebase-hygiene`, `owasp-security`, `karpathy-guidelines`, `supabase`, `supabase-postgres-best-practices`, `shadcn` |
| `.agents/agents/qa-reviewer.md`, `ui-reviewer.md`, `task-runner.md` | Reviewer subagents (model tier `pro`) · one-task runner used by `/loop-night` |
| `.agents/mcp_config.json` | `chrome-devtools` (screenshots, Lighthouse) and `shadcn` MCP servers |
| `.agents/models.conf`, `scripts/agy-run.sh` | Which model does which job · runs a stage on that model with fallback |
| `scripts/agy-setup.sh`, `agy-night.sh`, `agy-parallel.sh` | Check and permissions · continuous run · parallel copies |
| `scripts/step.sh`, `gate.sh`, `dev-up.sh`, `db-reset.sh` | Commit+push a step · quality gate · local stack · local database reset |

## Things to know

- **The dev server is guarded.** Agents start the app only through
  `scripts/dev-up.sh`, which attaches a watchdog: it stops a server that spins
  the CPU with nobody connected, one that nobody has used for 45 minutes, or
  one whose build cache passed 4 GB (and deletes that cache). `/loop-night`
  and the runner scripts also stop the app when they end. To cool the Mac at
  any time: `scripts/dev-down.sh` (add `--all` to stop the database too).

- Antigravity does not read `CLAUDE.md`, `.claude/commands` or `.claude/agents`
  by itself; the `.agents/` skills point it at those files.
- Rule files in `.agents/rules/` must start with frontmatter (`trigger:`) or
  they are silently ignored; each is capped at 24,000 bytes.
- "Workflows" are deprecated in Antigravity — the loop is implemented as skills.
- Using Claude Code *through an Antigravity login* is against Antigravity's
  terms. This setup does not do that: each tool uses its own account.
- To connect Antigravity to the platform's own data later (task AI-1), add the
  server to `~/.gemini/config/mcp_config.json` with `serverUrl` and your token.
