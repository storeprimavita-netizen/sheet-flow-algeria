# Continuing this project with OpenAI Codex (desktop app)

Codex works the same plan, the same loop and the same skills as Claude Code.
Shared state is git: plan, specs, briefs and reviews on branch `v3`. Codex
lives inside the **ChatGPT desktop app** (ChatGPT menu → Codex).

> **Status (2026-11-21): prepared and checked against the real Codex program
> (0.171, the one inside the app), but no task has been built with it yet.**
> Checked for real: the command rules (18 sample commands), that Codex loads
> the project settings, the 18 skills and the 3 project agents once the folder
> is trusted, what the sandbox allows, the Claude Opus review script, the two
> hooks. Not checked — it needs a live chat: starting agents from the night
> run, the stop hook inside the app, the automatic reviewer, usage limits.

## 1. Before the first run (once)

In Terminal, in the project folder:
```
scripts/codex-setup.sh --trust     # marks this folder as trusted for Codex, then checks everything
```
It must end with `READY`. Then **quit and reopen the ChatGPT app**.

In the app (Codex):
1. Add the project folder `~/Documents/Projects/sheet-flow-algeria` if it is not there yet.
2. New chat. Under the message box:
   - work in **Local** — not Worktree, not Cloud. A worktree chat has no
     branch, so nothing could be pushed; the night run refuses to start there.
   - permissions: **Custom (config.toml)**. (If that choice is missing, use
     **Approve for me**. Not "Ask for approval": it waits for your click at
     night. Not "Full access": it switches the sandbox off.)
3. **Review hooks** (in the message box, or Settings → Hooks): trust the two
   project hooks, "project command rules" and "night run check". They must be
   trusted again whenever a file under `.codex/` changes.
4. Settings → General → **Prevent sleep while running**: on. Keep the lid open
   and the charger in.
5. Docker running (the night run starts the local database and the app itself).

## 2. Start the night run

Type in the chat:
```
$loop-night
```
Variants: `$loop-night 3` (stop after 3 tasks) · `$loop-night nodb` (only
tasks without a database change — for a second agent next to Claude Code).

What you see: `NIGHT RUN started · …`, then one line per task
(`✔ 22:41  STORE-4 shipped …` or `■ 23:10  CONF-2 parked — …`), and at the end
a report whose last line is `NIGHT RUN ended · <why>`. Each stage runs in its
own agent thread; you can open one in the app to watch it.

- **Stop it:** press stop in the chat, then type `stop the night run` (it
  deletes the file `.night-run`, which is what keeps the run going). Every
  finished step is already pushed.
- **It stopped by itself** (usage limit, app closed): type `$loop-night` again.
  It continues from the plan.
- **One task only, to try:** `$loop-auto` or `$loop-auto STORE-4`.
- **Where things stand:** `$loop-bootstrap`.

If it says `NIGHT RUN not started · …`, the line tells you what to do.

Do not run Codex and Claude Code in this folder at the same time (one git
checkout). One at a time, or give Codex its own copy of the project and start
it there with `$loop-night nodb`.

## 3. Who does what (D96)

| Job | In Codex | Was, in Claude Code |
|---|---|---|
| Night coordinator (the chat you see) | the Codex chat; it only starts stages and prints one line each | Sonnet |
| Brief, build, ship, answer a task's question | a fresh `stage-runner` agent per stage | Sonnet / Haiku / Fable |
| Review of high-risk and security work | **Claude Opus** through Claude Code (`scripts/review-high.sh`); when Claude is signed out or at its limit, Codex's own `qa-reviewer` | Opus |
| Review of screens | Codex `ui-reviewer` with the Chrome tools | Sonnet |

No model name is written in the project: Codex uses the model you choose in
the app. High-risk reviews use your Claude limit; to keep them off it, create
an empty file named `.no-claude-review` in the project folder — the run then
uses Codex's own `qa-reviewer`. Delete the file to go back to Opus.

## 4. What Codex may and may not do here

Measured with the app's own sandbox: Codex can edit files in this folder, but
cannot write `.git`, `.codex` or `.agents`, and has **no network** — not even
to the local database. So it cannot commit, push, start the app or run the
database tests by itself. Three layers decide what happens:

1. **Sandbox** — as above.
2. **Rules** (`.codex/rules/mnw.rules`) — the project's own scripts
   (`step.sh`, `push.sh`, `gate.sh`, `db-reset.sh`, `gen-types.sh`,
   `dev-up.sh`, `dev-down.sh`, `review-high.sh`, `notify.sh`), local git branch
   commands, the web-guides tool and SQL on the local database run outside the
   sandbox. Raw push, raw commit, `main`, `reset --hard`, remote Supabase
   commands, `npm run dev`, `sudo` and Vercel are forbidden.
3. **Guard** (`.codex/guard.py`, a hook) — reads the whole command text and
   blocks the same things when they are hidden inside a longer command.

So every commit goes through `scripts/step.sh` (secret scan, refuses `main`)
and every push through it or `scripts/push.sh`.

Known weak point: the allowed scripts live in `scripts/`, which Codex can
edit, and they run outside the sandbox. The gate fails a task that changes
them or anything under `.codex/`, but that is a check after the fact.

## 5. Files

| File | What |
|---|---|
| `AGENTS.md` | project rules — Codex reads it by itself |
| `.agents/skills/` | skills, shared with Antigravity: `loop-night`, `loop-auto`, `loop-analyse`, `loop-execute`, `loop-verify`, `loop-decide`, `loop-ship`, `loop-bootstrap`, plus design, database and security skills |
| `.codex/config.toml` | sandbox, automatic approval review, thinking level, browser and shadcn tools, Codex-only notes |
| `.codex/agents/*.toml` | `stage-runner`, `qa-reviewer`, `ui-reviewer` |
| `.codex/rules/mnw.rules`, `.codex/guard.py` | which commands are allowed |
| `.codex/night-stop.py` | keeps a night run going until it prints `NIGHT RUN ended` (stops after 16 hours, or after 6 nudges with no new commit) |
| `.codex/hooks.json` | wires the two hooks |
| `scripts/codex-setup.sh` | readiness check; `--trust` marks the folder trusted |
| `scripts/review-high.sh` | high-risk review by Claude Opus |
| `scripts/push.sh`, `scripts/gen-types.sh` | push the current `v3` branch · database types from the local database |
| `scripts/codex-night.sh` | the same night run from Terminal with the Codex CLI (one fresh session per task) — untested |

## 6. If something does not work

- **`NIGHT RUN not started · project settings not loaded`** → the folder is
  not trusted: `scripts/codex-setup.sh --trust`, quit and reopen the app.
- **`NIGHT RUN not started · this chat runs in a worktree`** → new chat, Local.
- **The chat stops after one task and nothing continues** → the "night run
  check" hook is not trusted (Review hooks). Until it is, type
  `/goal run $loop-night until it prints NIGHT RUN ended`.
- **It waits for you to approve a command** → permissions are on "Ask for
  approval"; switch to Custom (config.toml) or Approve for me.
- **A stage reports a blocked command although it is an allowed script** → it
  was called inside a longer command (`cd … &&`, `2>&1`, a pipe). Tell the chat:
  "call project scripts alone, one per call".
- **Stages cannot be started as agents** → tell the chat `run each stage
  yourself with its skill instead of stage-runner`; it works, the chat just
  grows faster.
- **After changing any file under `.codex/`** → `scripts/codex-setup.sh`, then
  trust the hooks again.
