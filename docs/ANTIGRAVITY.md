# Antigravity on this project

Antigravity (Google's agent app + `agy` CLI) works the same plan, the same loop
and the same skills as Claude Code. Shared state is git: the plan, specs,
briefs and review files on branch `v3`.

> **Status: prepared, not yet run.** `agy` was not installed on this Mac when
> this was written, so nothing below has been executed here. File locations
> and flags come from antigravity.google/docs (read 2026-11-17). The first run
> should be interactive so you can see that rules, skills and subagents load.

## What is in the repo for Antigravity

| Path | What | Loaded how |
|---|---|---|
| `AGENTS.md` | Project conventions (shared with Claude Code) | always |
| `.agents/rules/antigravity.md` | "You are the Antigravity agent" rules: claim as `claimed:antigravity`, push every step, never `main` | `trigger: always_on` |
| `.agents/skills/loop-*` | The loop: `loop-bootstrap`, `loop-analyse`, `loop-execute`, `loop-verify`, `loop-ship`, `loop-auto` | `/loop-auto 3`, or by description |
| `.agents/skills/<shared>` | Symlinks to `.claude/skills/`: `cod-ui-polish`, `luxe-modesty-store-theme`, `modern-web-guidance` (Google Chrome), `mnw-codebase-hygiene`, `owasp-security`, `karpathy-guidelines` | by description |
| `.agents/agents/qa-reviewer.md`, `ui-reviewer.md` | Reviewer subagents (model tier `pro`) | started by `loop-verify` |
| `.agents/mcp_config.json` | `chrome-devtools` (screenshots, Lighthouse) and `shadcn` MCP servers | workspace MCP config |
| `scripts/step.sh` | Commit + push one step (refuses `main`, secret-scans, never forces) | called by every stage |
| `scripts/gate.sh` | The quality gate that decides "done" | called by execute/ship |
| `scripts/agy-loop.sh` | Headless run of the loop | you, from a terminal |

The loop stages are thin wrappers that point at `.claude/commands/*.md`, so
there is one definition of each stage for both agents.

## One-time setup (owner)

1. Install and sign in:
   ```
   curl -fsSL https://antigravity.google/cli/install.sh | bash
   agy --version
   agy            # opens the TUI in the current folder; sign in once
   ```
2. In the project folder: `npm ci`, create `.env.local`, start local Supabase
   (owner input O-1 in the plan). Without it, database tasks stop by design.
3. Permissions — `~/.gemini/antigravity-cli/settings.json` (user-level; this
   repo cannot set it for you). A starting point; check the exact rule syntax
   with the permissions page of the docs:
   ```json
   {
     "permissions": {
       "allow": [
         "command(git)",
         "command(git push)",
         "command(regex:scripts/(gate|step|secret-scan)\\.sh.*)",
         "command(regex:npx (tsc|vitest).*)",
         "command(regex:npm (ci|run build|run dev|test).*)"
       ],
       "deny": [
         "write_file(.git/)",
         "command(regex:git push.*(--force|-f).*)",
         "command(regex:git push.* main.*)",
         "command(regex:.*supabase db push.*)"
       ],
       "ask": ["command(*)"]
     }
   }
   ```
   Deny beats ask beats allow. `command(git push)` is needed because the
   sandbox has no network by default.
4. Check that everything loaded, interactively: run `agy`, then `/skills
   reload`, and ask "which rules, skills and subagents do you see for this
   project?". You should get the `loop-*` skills, the five shared skills and
   the two reviewers. If the shared skills are missing, your build does not
   follow symlinks: run `scripts/sync-agent-skills.sh --copy` and reload.

## Running the loop

Interactive (recommended until you trust it):
```
git checkout v3 && git pull
agy
> /loop-bootstrap          # where are we
> /loop-auto 1             # one task, end to end
> /loop-auto NAV-1         # a specific task
```

Headless:
```
scripts/agy-loop.sh 2                 # two tasks
AGY_MODEL=<slug> scripts/agy-loop.sh STORE-2
```
In headless mode an action that needs approval is refused quietly and the run
still exits 0 — read the final report, not the exit code.

## Several agents at once

- **Antigravity App**: start each agent in "New Worktree mode" so it gets its
  own working copy and branch; give each a different task id
  (`/loop-auto CONF-3`). `/swarm <task>` (coordinator + workers + verifier) is
  an option for one large task on paid plans.
- **CLI**: one worktree per task, one `agy` per worktree:
  ```
  git worktree add .worktrees/CONF-3 -b v3-CONF-3 v3
  cd .worktrees/CONF-3 && npm ci && cp ../../.env.local . && agy
  ```
- **Claude Code and Antigravity together**: fine. Both claim tasks in
  `docs/MASTER_PLAN.md` on `v3` (`claimed:claude` / `claimed:antigravity`) and
  push the claim before building; whoever pushes second gets a rejected push,
  pulls, and picks another task. Run at most three tasks at once, in different
  lanes, with at most one migration among them (`.claude/loop.md`).
- A good split: one agent builds, the **other one reviews** — a review by a
  different model family catches different mistakes. `/loop-verify <id>` in
  Antigravity on a task Claude built (or `/verify <id>` in Claude Code on an
  Antigravity task) writes the same verdict file.

## Connecting Antigravity to the platform's data (later)

Once task AI-1 ships, add the platform's MCP server to
`~/.gemini/config/mcp_config.json` (not the repo — it carries your token):
```json
{ "mcpServers": { "mnw": { "serverUrl": "https://<app>/api/mcp", "headers": { "Authorization": "Bearer <token from Settings → Integrations → AI connector>" } } } }
```
Antigravity accepts Streamable HTTP servers only (`serverUrl`).

## Things to know

- Antigravity does not read `CLAUDE.md`, `.claude/commands` or
  `.claude/agents`; that is why the shared rules moved to `AGENTS.md` and the
  loop was ported to `.agents/`.
- Rule files in `.agents/rules/` must start with frontmatter (`trigger:`) or
  they are silently ignored; each is capped at 24,000 bytes.
- "Workflows" are deprecated in Antigravity — the loop is implemented as
  skills on purpose.
- Antigravity's FAQ says that using third-party tools such as Claude Code
  *through an Antigravity login* breaks its terms. This setup does not do
  that: each tool runs with its own account.
- Reviewer subagents use model tier `pro`; change `model:` in
  `.agents/agents/*.md` (`inherit | flash | pro`) if your plan differs.
