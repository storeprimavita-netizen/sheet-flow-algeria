# Continuing this project with Google Antigravity CLI (`agy`)

Antigravity works the same plan, the same loop and the same skills as Claude
Code. Shared state is git: plan, specs, briefs and reviews on branch `v3`.

> **Status: installed and signed in (agy 1.5.13, 2026-11-21); the loop itself
> has not been run in it yet.** The setup check passes; no task has been built.
> Facts come from antigravity.google/docs, read 2026-11-17 and 2026-11-20.
> Do the first task by hand in the TUI before trusting an unattended run.

## Gemini CLI or Antigravity CLI?

Use **Antigravity CLI (`agy`)**. Gemini CLI stopped serving Google AI Pro,
Ultra and free accounts on 2026-06-18; it only works with paid API keys now.
`agy` is its replacement and is what a Google AI Pro subscription covers.

## Models

What this Mac's account lists (`agy models`, checked 2026-11-21, agy 1.5.13):

| Model in `agy` | Use it for |
|---|---|
| **Gemini 3.8 Flash (High)** — `gemini-3.8-flash-high` | Default for the loop |
| Gemini 3.8 Flash (Medium / Low) | Cheaper, for routine follow-ups |
| Claude Sonnet 4.6 / Opus 4.6 (Thinking) | Reviews and hard tasks; separate limit from Gemini |
| GPT-OSS 120B (Medium) | Not used by the loop |

The Argon / Hydrogen / Orchestrator models described in Antigravity's docs are
**not** in this account's list. If they appear later (plan change, rollout),
pick them with `/model`; nothing in the repo depends on a model name.

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
Inside it: `/model` → choose **Gemini 3.8 Flash (High)** (the choice is remembered).

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
This writes `~/.gemini/antigravity-cli/settings.json` (your existing file is
backed up, and its other settings such as trusted folders are kept): git, the
project's scripts, tests and builds are allowed; force
push, pushing to `main`, pushing to the real database and `sudo` are denied;
everything else asks. The rule syntax was not tested here — if `agy` complains
about the file, restore the backup and set the same rules in its settings.

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
It stays in the session in front of you: one line per finished task, a short
summary every five tasks, and a report at the end. Each task is handed to a
fresh `task-runner` subagent, so the session itself stays small.

```
> /loop-night 5            stop after five tasks
> /loop-night nodb         only tasks that do not change the database
```
Keep the Mac awake while it runs: in another Terminal window, `caffeinate -ims`
(leave it open; `Ctrl+C` ends it). Lid closed: `sudo pmset -a disablesleep 1`.

If your usage limit is reached, the session stops and cannot wake itself. When
the limit resets, type `/loop-night` again — it continues from the plan; every
finished step was already pushed. (If you prefer it to wait and resume by
itself with nobody there, `scripts/agy-night.sh` does that from a plain
Terminal, but you see less.)

### Following it from your phone

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

Other ways to parallelise inside Antigravity (paid plans): `/swarm <task>`
(coordinator + workers + verifier on one large task) and `/teamwork`. In the
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
