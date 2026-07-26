# Tooling for execution chats (Sonnet)

## MCP tools "graphify" and "poneytail"

**Inspected 2026-07-26 (Fable planning chat): neither tool is exposed as an MCP
tool in this environment.** A tool-registry search for both names returned no
matches. The only trace is `graphify-out/manifest.json` — a stale file-index
artifact (mtime/AST-hash map covering unrelated projects), already gitignored.
Treat it as garbage; do not read it for context.

**Instruction to Sonnet:** do NOT attempt to call `graphify` or `poneytail`.
If a future session shows them in the MCP tool list, note their actual
descriptions in this file first, then propose usage — until then, plan/track
work with the files below.

## What replaces them

| Need | Tool |
|---|---|
| Task tracking across chats | `PROGRESS.md` (append a block per phase — format inside the file) |
| Knowledge/memory between chats | `CLAUDE.md` (conventions) + `docs/*` (facts) — nothing else is shared |
| Diagrams | Not needed for execution; schema is documented in `docs/DB.md` |

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
