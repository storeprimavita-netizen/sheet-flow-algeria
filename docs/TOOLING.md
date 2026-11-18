# Tooling for execution chats (Sonnet)

## graphify (installed 2026-07-26 — CLI + CLAUDE.md rules)

Local knowledge-graph CLI (`~/.local/bin/graphify`), no MCP. The graph lives
in `graphify-out/` (gitignored, regenerated locally): 611 nodes / 49
communities covering `src/` + `supabase/migrations/`.

**When Sonnet must use it (rules also injected via CLAUDE.md §graphify):**

- Before hunting through unfamiliar code: `graphify query "<question>"`
  (add `--budget 1500` if truncated) — returns a scoped subgraph, cheaper
  than grepping around.
- Relationship questions: `graphify path "A" "B"`; concept overviews:
  `graphify explain "X"`; blast radius before refactors:
  `graphify affected "X"`.
- **After modifying code: `graphify update .`** (AST-only, seconds, no LLM) —
  end-of-phase requirement alongside the build gate.
- Don't read `graphify-out/GRAPH_REPORT.md` unless query/path/explain fell
  short; never read `graphify-out/graph.json` raw.

## ponytail (installed 2026-07-26 — Claude Code plugin skills)

Anti-over-engineering skill set. Not a poney: it forces the laziest solution
that works (stdlib > deps, one line > fifty, YAGNI).

**When Sonnet must use it:**

- **Invoke the `ponytail:ponytail` skill at the start of every phase's
  implementation work** (default `full` intensity). This codebase's bar is
  "simple > clever" (SPEC §10) — ponytail is how we hold it.
- Before merging a phase: run `ponytail:ponytail-review` on the diff and act
  on findings (delete speculative abstractions, replace reinvented stdlib).
- Leave deliberate shortcuts as `// ponytail: <what was deferred>` comments;
  Phase 10 runs `ponytail:ponytail-debt` to harvest them.
- Do NOT let ponytail argue away spec'd requirements (RLS policies, audit
  triggers, zod validation, i18n strings are non-negotiable — it trims HOW,
  not WHAT).

## What tracks work between chats

| Need | Tool |
|---|---|
| Task tracking across chats | `PROGRESS.md` (append a block per phase — format inside the file) |
| Knowledge/memory between chats | `CLAUDE.md` (conventions) + `docs/*` (facts) |
| Codebase orientation | `graphify query` (above) |

## UI phases (11–13) tooling

| Tool | Status | Use |
|---|---|---|
| **Playwright MCP** | ✅ available | The mandatory screenshot self-critique. Screenshot every touched screen in both themes → `docs/design/audit/`; fix what the shots show before closing the phase. Highest-value tool for the UI pass. |
| **shadcn MCP** | ✅ configured (`.mcp.json`) | Install/theme shadcn (Radix) components in phase 11 — replaces the native `<select>`. |
| **Supabase (local)** | ✅ docker stack | Run the app for screenshots: `docker`-hosted stack at `http://127.0.0.1:54321`, `npx supabase status` for keys, seed users in `scripts/seed-dev.ts` (`admin@seed.mnw` / `SeedDev!2026`). Point a dev server's `NEXT_PUBLIC_SUPABASE_*` at local, not the remote project. |
| `cod-ui-polish` skill | ✅ `.claude/skills/cod-ui-polish/` | Auto-triggers on any UI work; the design authority. |

The design authority for phases 11–13 is the `cod-ui-polish` skill +
`docs/design/DESIGN_SYSTEM.md` (approved direction: A — Slate & Emerald) +
`docs/design/UI_AUDIT.md`.

## Supabase CLI

- Migrations live in `supabase/migrations/` (v2 baseline). Legacy v1 set is in
  `supabase/migrations_legacy/` — never apply it.
- Apply with `npx supabase db push` (project is linked; see `supabase/.temp/`),
  or paste into the Dashboard SQL editor in file order.
- After any migration: `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
  Never hand-edit that file.

## Testing

- `npm run build` must pass at the end of every phase.
- Pricing math: unit tests against the sheet's pinned values (Phase 4).
- RLS: SQL-level tests using two seeded users (admin + agent) — Phase 10
  checklist, but any phase touching policies should smoke-test with an agent
  login.

## Design / quality / security skills (added 2026-10-11, Phase 15)

Vendored into `.claude/skills/` (project-scoped, so every phase chat gets
them). Sources pinned at clone time; re-vendor deliberately, never auto-update.

| Skill | Source | Use it for | Notes |
|---|---|---|---|
| 🎨 `impeccable` | github.com/pbakaus/impeccable (Apache-2.0) | `critique` / `audit` / `layout` / `polish` / `harden` on any screen; Operate mode for app UI | **Launcher NOT vendored** (it downloads an unpinned binary). Always take its "Launcher unavailable" path: read `docs/design/DESIGN_SYSTEM.md` + `cod-ui-polish` as the design context, then the command's `reference/*.md`. |
| 🧭 `ui-ux-pro-max` | github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT) | UX rules by priority (a11y → touch → perf → layout → charts); `references/quick-reference.md`, `references/pro-rules.md`, `data/charts.csv`, `data/ux-guidelines.csv` | Its `scripts/search.py` is local-only Python; running it needs user permission (classifier blocks third-party scripts by default). Reading the CSV/MD data directly is enough. |
| ✨ `frontend-design` | Anthropic official plugin | Aesthetic direction, avoiding templated defaults | Subordinate to `cod-ui-polish` (Slate & Emerald is approved — don't re-pick a palette). |
| 🛡️ `owasp-security` | github.com/agamm/claude-code-owasp | Security review of every phase touching API routes, webhooks, actions, migrations/RLS, auth | Use its triage rubric — only reachable findings. Mandatory before merging any ZR Express / webhook / auth work. |
| 🧠 `karpathy-guidelines` | github.com/forrestchang/andrej-karpathy-skills (MIT) | Think-before-coding, surgical diffs, verifiable success criteria | Complements `ponytail` (ponytail = do less; karpathy = state assumptions + define the check). |

**Precedence when they disagree:** project rules (CLAUDE.md, locked decisions,
`cod-ui-polish`, DESIGN_SYSTEM.md) > `impeccable` / `ui-ux-pro-max` /
`frontend-design` taste. Impeccable's "go bold" never overrides "no hardcoded
colors", the status system, or RTL logical props.

## v3 tooling update (2026-11-17)

- **Loop v3** replaces everything above about workflow: `.claude/loop.md`,
  `/auto`, `scripts/gate.sh`, `scripts/step.sh`. Branch `v3`, not `mnw`.
- **graphify is optional.** The repo moved to macOS where it is not installed;
  hooks in `.claude/settings.json` call it only if it is on PATH. Without it,
  use Explore + targeted Grep.
- **ponytail** is a user-level plugin; use it when installed, otherwise
  `karpathy-guidelines` + `mnw-codebase-hygiene` cover the same ground.
- **Browser MCPs** in `.mcp.json`: `chrome-devtools` (pinned 1.13.0; snapshots,
  screenshots, Lighthouse for the store speed budget) and `shadcn`. Playwright
  MCP works too if installed at user level. One of them is required for any
  `ui` task.
- **New/changed skills**: `luxe-modesty-store-theme` (store only, built from
  the owner's theme), `cod-ui-polish/references/navigation-ia.md` (IA v3),
  `mnw-codebase-hygiene` (feature folders, data layer, thin actions, RLS rules).
- **Antigravity**: `.agents/` + `docs/ANTIGRAVITY.md`.

### modern-web-guidance (added 2026-11-17, owner request)

Google Chrome's skill (github.com/GoogleChrome/modern-web-guidance, Apache-2.0,
stewarded with Edge, Firefox and MDN). Claude Code gets it from the owner's
user-level plugin (`modern-web-guidance@googlechrome`, auto-updating; on a new
machine: `/plugin marketplace add GoogleChrome/modern-web-guidance` then
`/plugin install modern-web-guidance@googlechrome`). For Antigravity a copy of
`SKILL.md` + `LICENSE` (commit `64a6d708f5a4`) is vendored in
`.agents/skills/modern-web-guidance/`. The ~260 guides are **not** in the repo: the skill
fetches them at use time with `npx -y modern-web-guidance@latest search|retrieve`
(needs network; runs Google's published npm package, unpinned by design).
Precedence and the browser-support policy are in AGENTS.md. To update: re-copy
`SKILL.md` from the repo. Antigravity alternative:
`agy plugin install https://github.com/GoogleChrome/modern-web-guidance`.

### Supabase skills (installed by the owner 2026-11-17)

`npx skills add supabase/agent-skills` → `supabase` (v0.1.2) and
`supabase-postgres-best-practices` (v1.1.1, MIT), commit `c9be0e931b79`, pinned
in `skills-lock.json`. Real files live in `.agents/skills/`, symlinked into
`.claude/skills/` (the opposite direction from the project's own skills — both
agents see both sets). Markdown only, no scripts. Project overrides are in
AGENTS.md → RLS section (numbered migrations, local stack only).

### shadcn skills (installed by the owner 2026-11-17)

`npx skills add shadcn/ui` → `shadcn` and `migrate-radix-to-base`, pinned in
`skills-lock.json`. Use `shadcn` for component composition rules. **Do not run
`migrate-radix-to-base`** — the app stays on Radix (AGENTS.md); it came along
with the install and is only for an owner-requested migration.

### Local stack on this Mac (set up 2026-11-17)

`scripts/dev-up.sh` starts colima → local Supabase (`supabase/config.toml`,
project id `mnw-erp`) → dev server. `.env.local` points at the local stack
only. Seed: `node --import ./scripts/seed-register.mjs --env-file=.env.local
scripts/seed-dev.ts` (the `--import` maps Next's `server-only` marker so plain
Node can load `admin.ts`). Continuous run: `scripts/night-run.sh [batch]` in a plain Terminal — runs `/auto <batch>` in fresh sessions one after another, shows readable progress (`scripts/fmt-stream.py`), waits out usage limits (`scripts/run-outcome.py` reads how each batch ended) and stops only when nothing is eligible or on a hard stop.

### Where the borrowed rules came from (read 2026-11-17; nothing new vendored)

| Source | What we took | Not taken |
|---|---|---|
| ZazenCodes software factory v2 (github.com/zazencodes/zazencodes-season-3, GPLv3 — ideas only, no code copied) | script-decided gate before any reviewer, reviewers routed by risk × surface, one verdict-first file per agent, max 3 rounds then human, protected paths, one worktree per job | GitHub-issue intake, auto-merge to main |
| Claude Code best practices (code.claude.com/docs/en/best-practices) | advisory vs enforced split, spec in a file + fresh session, read-only reviewer, explicit stop conditions | – |
| Anthropic "harness design for long-running apps" | separate evaluator that drives the running app | sprint/context-reset machinery |
| Impeccable 4.5.2 (already vendored, manual) | ≤ 5 nav groups, no icon-only nav, always show location, no emoji as icons, skeletons, empty states teach | its launcher, hooks and live mode (run outside model approval) |
| Vercel web-interface-guidelines | URL holds filters/tabs, links vs buttons, aria-label on icon buttons, confirm/undo, tabular-nums | the skill itself (it fetches remote instructions at run time) |
| shadcn skill | semantic tokens only, no manual `dark:` overrides | – |
| Next.js docs (project structure, data security) | `_components`/`_lib` private folders, server-only data layer returning DTOs, thin re-authorising actions | – |
| Supabase agent-skills | `to authenticated`, `(select …)` wrapping, USING + WITH CHECK, `security_invoker` views, no `user_metadata` auth | – |

Optional installs if wanted later (review before committing):
`npx skills add supabase/agent-skills`, `npx skills add shadcn/ui`,
`npx impeccable detect src/` (deterministic UI lint).
