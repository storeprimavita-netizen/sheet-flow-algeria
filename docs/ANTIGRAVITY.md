# Continuing this project with Google Antigravity CLI (`agy`)

Antigravity works the same plan, the same loop and the same skills as Claude
Code. Shared state is git: plan, specs, briefs and reviews on branch `v3`.

> **Status: prepared, not yet run.** `agy` was not installed on this Mac when
> this was written (2026-11-20), so nothing below has been executed here.
> Facts come from antigravity.google/docs, read 2026-11-17 and 2026-11-20.
> Do the first task by hand in the TUI before trusting an unattended run.

## Gemini CLI or Antigravity CLI?

Use **Antigravity CLI (`agy`)**. Gemini CLI stopped serving Google AI Pro,
Ultra and free accounts on 2026-06-18; it only works with paid API keys now.
`agy` is its replacement and is what a Google AI Pro subscription covers.

## Models (Google AI Pro, non-trial)

| Model in `agy` | Use it for |
|---|---|
| **Orchestrator (Argon)** | Default for the loop: plans with Argon, executes with Hydrogen in one turn |
| **Gemini 4 Argon** | Planning, reviews, hard problems |
| **Gemini 4 Hydrogen** | Fast implementation, routine tasks |
| Gemini 4 Neon / Orchestrator (Neon) | Stronger and slower; for the hardest tasks |
| Claude Sonnet 5.5 / Opus 5.5 (thinking) | Also selectable on Pro; separate limit from the Gemini models |

The names are **Argon** and **Hydrogen** (not "Aragon"). Exact identifiers for
your account: `agy models`. Limits are shown in the model picker as a weekly
and a five-hour bar; Gemini models and Claude/GPT models have separate bars.

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
Inside it: `/model` → choose **Orchestrator (Argon)** (the choice is remembered).

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
backed up): git, the project's scripts, tests and builds are allowed; force
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

## 5. The night run

```
scripts/agy-night.sh
```
One task per fresh session, one after another, in the terminal in front of you.
It keeps the Mac awake, waits 20 minutes and retries when a usage limit is hit,
and ends when nothing is left that can run without you. `Ctrl+C` stops it.

```
AGY_MODEL="Gemini 4 Hydrogen" scripts/agy-night.sh        # faster, lighter model
AGY_MODEL="Orchestrator (Neon)" scripts/agy-night.sh      # stronger
```
Lid closed: `sudo pmset -a disablesleep 1` first (`0` to undo).

## 6. Parallel agents

```
scripts/agy-parallel.sh setup 2          # creates .worktrees/agy-2 and agy-3 (full copies, own ports)
```
Then one Terminal window per agent:
```
window 1:  scripts/agy-night.sh                                              # main agent, database tasks allowed
window 2:  cd .worktrees/agy-2 && APP_PORT=3001 scripts/agy-night.sh agy-2 nodb
window 3:  cd .worktrees/agy-3 && APP_PORT=3002 scripts/agy-night.sh agy-3 nodb
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
| `.agents/skills/loop-*` | The loop: bootstrap, analyse, execute, verify, decide, ship, auto |
| `.agents/skills/<shared>` | `cod-ui-polish`, `luxe-modesty-store-theme`, `modern-web-guidance`, `mnw-codebase-hygiene`, `owasp-security`, `karpathy-guidelines`, `supabase`, `supabase-postgres-best-practices`, `shadcn` |
| `.agents/agents/qa-reviewer.md`, `ui-reviewer.md` | Reviewer subagents (model tier `pro`) |
| `.agents/mcp_config.json` | `chrome-devtools` (screenshots, Lighthouse) and `shadcn` MCP servers |
| `scripts/agy-setup.sh`, `agy-night.sh`, `agy-parallel.sh` | Check and permissions · continuous run · parallel copies |
| `scripts/step.sh`, `gate.sh`, `dev-up.sh`, `db-reset.sh` | Commit+push a step · quality gate · local stack · local database reset |

## Things to know

- Antigravity does not read `CLAUDE.md`, `.claude/commands` or `.claude/agents`
  by itself; the `.agents/` skills point it at those files.
- Rule files in `.agents/rules/` must start with frontmatter (`trigger:`) or
  they are silently ignored; each is capped at 24,000 bytes.
- "Workflows" are deprecated in Antigravity — the loop is implemented as skills.
- Using Claude Code *through an Antigravity login* is against Antigravity's
  terms. This setup does not do that: each tool uses its own account.
- To connect Antigravity to the platform's own data later (task AI-1), add the
  server to `~/.gemini/config/mcp_config.json` with `serverUrl` and your token.
