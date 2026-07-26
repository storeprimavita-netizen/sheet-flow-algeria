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
