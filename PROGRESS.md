# PROGRESS — living handoff file

Every execution chat APPENDS a block here when its phase is done. Newest at
the bottom. Format:

```
## Phase X — <title> (<date>) — DONE|PARTIAL
- Done: ...
- Files: ...
- Decisions: ...
- Known issues: ...
- Next chat must know: ...
```

## Phase plan (v2)

| Phase | File | Status |
|---|---|---|
| 0 — DB rebaseline + auth foundation | docs/phases/phase-00.md | pending |
| 1 — Shell, six-section IA, guards, Slack removal | docs/phases/phase-01.md | pending |
| 2 — Settings section | docs/phases/phase-02.md | pending |
| 3 — Products (details/expenses/ad-spend/stock) | docs/phases/phase-03.md | pending |
| 4 — Pricing engine + Real + tests | docs/phases/phase-04.md | pending |
| 5 — Orders core (queues/history/customers/duplicates/cash) | docs/phases/phase-05.md | pending |
| 6 — Webhooks v2 | docs/phases/phase-06.md | pending |
| 7 — Dashboard BI | docs/phases/phase-07.md | pending |
| 8 — Contacts (customers/suppliers) | docs/phases/phase-08.md | pending |
| 9 — Team & Rules | docs/phases/phase-09.md | pending |
| 10 — Polish, seed, RLS tests, deploy | docs/phases/phase-10.md | pending |

## Planning (2026-07-26, Fable) — DONE

- Done: codebase audit (docs/AUDIT.md), final spec (docs/SPEC.md), v2
  workspace-scoped schema `supabase/migrations/00001–00007` (legacy v1 moved
  to `supabase/migrations_legacy/`, superseded), docs/DB.md, docs/TOOLING.md,
  phase files 00–10, CLAUDE.md conventions.
- Decisions (user-approved): clean DB rebaseline (dev data disposable);
  fold cash/stock/workbench/reports into the six spec sections; remove
  Slack; keep EN/AR i18n. Deviations list: docs/SPEC.md §Deviations
  (notably: webhooks stay Next.js route handlers, not Edge Functions).
- Known issues: v1 app code still points at dropped tables until Phase 0/1
  land — the repo builds now but will NOT run against the DB once the reset
  in phase-00 step 1 is executed. Do phases in order.
- Next chat must know: the live Supabase project is `apsulsbdrnlesggzzfak`
  (linked). `BENZ Pricing (31).xlsx` in repo root stays untracked (reference
  only — math already ported + verified in `src/lib/pricing.ts`).
- Tooling update (later on 2026-07-26): user installed **graphify** (CLI
  knowledge graph, `graphify-out/` regenerated — 611 nodes) and **ponytail**
  (Claude Code plugin skills). Usage rules: docs/TOOLING.md + CLAUDE.md
  (session protocol item 5 and §graphify). The earlier "not available" note
  is obsolete.

## Sonnet starter prompt (paste into each new execution chat)

```
Read CLAUDE.md, PROGRESS.md, then docs/phases/phase-XX.md.
Execute that phase only, on branch mnw-XX; read nothing else unless the phase file says so.
Use `graphify query` to orient instead of broad greps; invoke the ponytail:ponytail skill before writing code and ponytail:ponytail-review before merging.
When `npm run build` (and `npm test` once it exists) is green: run `graphify update .`, append your handoff block here, merge --no-ff into mnw.
```

## Phase 0 — DB rebaseline + auth foundation (2026-07-26) — PARTIAL (code complete + build green; remote reset needs the user, see below)
- Done: all code adapted to the v2 schema; `npm run build` green. `rbac.ts`
  now reads `profiles` (`getProfile()` → `{ role, workspaceId }`); orders/
  products/contacts/expenses/dashboard point at v2 tables and every insert
  sets `workspace_id`; status updates only touch `orders` (triggers write
  `order_status_history`); webhooks read secrets from `integration_configs`
  and upsert `customers` (source enum fixed to `lightfunnels`); enums updated
  (`no_answer`, SUPPLIER_TYPES, ORDER_SOURCES, DELIVERY_TYPES,
  CURRENCY_CODES, AD_KINDS) with EN/AR message keys. Types regenerated from a
  local Supabase (same migrations — regen `--linked` after the remote reset
  should be a no-op). Verified locally: migrations 00001–00007 apply clean and
  `bootstrap_workspace('sh.wailbmg@gmail.com','MNW')` yields 1 workspace,
  1 active admin, 58 wilaya_fees, 5 settings.
- Stubbed ("rebuild pending" placeholder pages, old components deleted):
  settings (Ph2), stock (Ph3), pricing (Ph4), cash + workbench (Ph5 — the
  `assignAgents` action moved to `orders/actions.ts`, assignment card kept),
  bi + reports (Ph7), team + roles (Ph9). Dashboard shows recent orders +
  quick links only; KPI tiles return with the Phase 7 RPC.
- Files: deleted `lib/slack.ts` (Slack removal pulled forward — it read
  `app_settings`), `lib/app-settings.ts`, `lib/pricing-server.ts`, and all v1
  manager components of the stubbed pages. Forms still do client-side inserts
  with a `workspaceId` prop (server-action conversion belongs to each
  feature's rebuild phase). Expense entry is DZD-only for now (`ponytail:`
  comment; currency/fx UI in Phase 3); products low-stock threshold is a
  const (settings key in Phase 3).
- Known issues: webhooks don't yet log to `webhook_events` nor update
  `last_event_at`, and assume a single workspace (Phase 6). Delivery-stage
  comments aren't persisted (v2 has only `confirmation_comment`; history
  trigger logs confirmation comments only).
- Next chat must know: **the remote reset was NOT executed** — the Claude Code
  permission classifier blocks destructive remote DB commands, so the user
  must run, in order: (1) `npx supabase db reset --linked` (or the drop-schema
  block from docs/DB.md §Applying + `npx supabase db push`); (2) sign up
  `sh.wailbmg@gmail.com` at `/login`; (3) in the SQL editor:
  `select public.bootstrap_workspace('sh.wailbmg@gmail.com','MNW');`
  (4) `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
  (expected no-op) and the phase-00 acceptance spot-checks (agent user sees
  no financial rows). Until then the deployed app has no working DB. A local
  Supabase db container (`supabase_db_mnw-erp`, port 54322) was left from
  type generation — `npx supabase stop` to clean up.
