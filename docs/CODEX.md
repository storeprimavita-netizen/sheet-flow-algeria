# Continuing this project with OpenAI Codex CLI (`codex`)

Codex works the same plan, the same loop and the same skills as Claude Code.
Shared state is git: plan, specs, briefs and reviews on branch `v3`.

> **Status (2026-11-21): prepared, not run.** Codex was not installed on this
> Mac when these files were written, so nothing below was tried against the
> real tool except the two pieces that do not need it (the Claude Opus review
> script and the command guard). Facts come from the Codex docs read that day
> (developers.openai.com/codex). `scripts/codex-setup.sh` tests the rest once
> Codex is installed — run it before trusting a night run.

## 1. Install, sign in, check (once)

```
npm install -g @openai/codex
codex login                    # opens the browser; sign in with your ChatGPT account
cd ~/Documents/Projects/sheet-flow-algeria
scripts/codex-setup.sh         # must end with READY
```
Then start `codex` in this folder and:
1. Accept **trust this folder** — without it Codex ignores everything in `.codex/`.
2. Type `/hooks` and trust the project guard (`.codex/guard.py`). It has to be
   trusted again whenever that file or `.codex/hooks.json` changes.
3. Type `/status` — it shows the model, the sandbox and your remaining usage.

## 2. Use it

| You want | Do |
|---|---|
| See where things stand | in `codex`: `$loop-bootstrap` |
| One task, watching it | in `codex`: `$loop-auto` (or `$loop-auto STORE-4`) |
| Task after task, unattended | in Terminal: `scripts/codex-night.sh` |
| A second agent next to Claude Code | `scripts/codex-night.sh codex nodb` (only tasks without a database change) |
| Stop | `Ctrl+C` — every finished step is already pushed |

Skills are called with `$name` in Codex (not `/name`); `/skills` lists them.
`scripts/codex-night.sh` starts a fresh Codex session per task, waits 30
minutes and tries again when the usage limit is reached, and stops when
nothing is left that can run without you. Logs: `~/Library/Logs/mnw-codex-*.log`.

Running Codex and Claude Code **at the same time in this same folder** does not
work (one git checkout). Either run one at a time, or give Codex its own copy
of the project and start it there with `nodb`.

## 3. Who does what (D96)

| Job | In Codex | Was, in Claude Code |
|---|---|---|
| Lead a task, write the brief, build | the Codex session, thinking level medium | Sonnet |
| Answer a question a task raised (`loop-decide`) | the same Codex session | Fable |
| Review of high-risk and security work | **Claude Opus** through Claude Code (`scripts/review-high.sh`); when Claude is signed out or at its limit, Codex's own `qa-reviewer` at thinking level high | Opus |
| Review of screens | Codex `ui-reviewer` with the Chrome tools | Sonnet |

No model name is written in the project: Codex uses the model of your plan, or
the one you choose with `/model`. For the night run: `CODEX_MODEL=<id>
scripts/codex-night.sh`. To keep high-risk reviews off your Claude usage:
`REVIEW_WITH_CLAUDE=0 scripts/codex-night.sh`.

## 4. What Codex may and may not do here

Codex runs commands in a sandbox: it can edit files in this folder and use the
network (local database, npm), but cannot write `.git`, `.codex` or `.agents`.
Three layers keep the project rules:

1. **Sandbox** — `git commit` and `git push` cannot work from inside it.
2. **Rules** (`.codex/rules/mnw.rules`) — the project's own scripts
   (`step.sh`, `push.sh`, `gate.sh`, `db-reset.sh`, `dev-up.sh`, `dev-down.sh`,
   `review-high.sh`, `notify.sh`) and local git branch commands run outside the
   sandbox; raw push, raw commit, `main`, `reset --hard`, remote Supabase
   commands, `npm run dev`, `sudo` and Vercel are forbidden.
3. **Guard** (`.codex/guard.py`) — reads the whole command text and blocks the
   same things when they are hidden inside a longer command.

So every commit goes through `scripts/step.sh` (secret scan, refuses `main`)
and every push through it or `scripts/push.sh`.

Known weak point: the allowed scripts live in `scripts/`, which Codex can
edit, and they run outside the sandbox. The gate fails a task that changes
`step.sh`, `push.sh`, `gate.sh`, `review-high.sh` or anything under `.codex/`,
but that is a check after the fact, not a wall.

## 5. Files

| File | What |
|---|---|
| `AGENTS.md` | project rules — Codex reads it by itself |
| `.agents/skills/` | skills, shared with Antigravity (`loop-*`, design, database, security) |
| `.codex/config.toml` | sandbox, thinking level, browser and shadcn tools, Codex-only notes |
| `.codex/agents/*.toml` | `qa-reviewer`, `ui-reviewer` |
| `.codex/rules/mnw.rules`, `.codex/hooks.json`, `.codex/guard.py` | what commands are allowed |
| `scripts/codex-setup.sh` | readiness check (changes nothing) |
| `scripts/codex-night.sh` | task after task |
| `scripts/review-high.sh` | high-risk review by Claude Opus |
| `scripts/push.sh` | push the current `v3` / `v3-<id>` branch |

## 6. If something does not work

- **Codex asks before every command, or ignores the skills' rules** → the
  folder is not trusted; start `codex` here and accept, then `scripts/codex-setup.sh`.
- **`scripts/codex-setup.sh` says the command rules do not answer as intended**
  → the rule format changed in your Codex version. Do not start a night run;
  the fix is in `.codex/rules/mnw.rules`.
- **A step is "blocked" although it is one of the allowed scripts** → it was
  called inside a longer command (`cd … &&`, `2>&1`, a pipe). It must be called
  alone: `scripts/gate.sh`.
- **Night run stops with "3 sessions in a row ended without a result"** → read
  the last lines it prints; usually sign-in, or a flag your Codex version does
  not know (`CODEX_FLAGS` adds flags; the command is in `scripts/codex-night.sh`).
