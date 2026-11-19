# CONF-1 brief — saved order views (table), tabs, URL state, seeded shared views
risk: high · surface: ui · lane: orders (M: migration 00056 — 00051 parked on v3-STORE-3, 00052–00055 taken)

Goal: confirmation/delivery/all-orders pages show view tabs; a view = saved filters + sort + columns, state lives in the URL, shared views are seeded.

## Done when
- `order_views` exists with RLS: user reads shared (owner_id null) + own; writes own; only admin writes shared; agent cannot read another's private view or write a shared one.
- Tabs above the table on `/app/orders/confirmation`, `/delivery`, `/all` list views of that scope; active view = `?view=<id>`; unsaved filter/sort/column edits stay in the URL, "Save" / "Save as" / "Reset" act on them.
- Seeded shared views exist per workspace (existing and future).
- Link opened by a teammate reproduces the same list (agent still limited by orders RLS).
- Layout is `table` only (kanban = CONF-2); gate green incl. live RLS suite (D24), en/ar parity.

## Drift found
- No `order_views`, `callback_at` or attempt timeline exist: "Callbacks due" needs CONF-4 and "Kanban by status" needs CONF-2, so seed only: New (wait_for_confirmation) · No answer / closed phone · Today confirmed · Duplicates. Spec seed list is stale for the other two; CONF-1/CONF-2/CONF-4 each add theirs.
- "shipping" scope = the delivery queue page (`orders/delivery`); filters today are page-specific: `all` uses URL params via `orders-filter-bar.tsx` (status, product, wilaya, source, duplicates, agent, from/to, q, sort, dir, page); confirmation page only has `?show=all`.
- Confirmation page query is fixed (`ACTIONABLE_CONFIRMATION`); a view's status filter must replace it, not stack.
- Filters not yet existing (attempts, age, score band, season) are out of scope; config stores only filters that work today. Config is data, never trusted: zod allow-list of keys on write AND on read; unknown keys dropped.

## Migration 00056_order_views.sql
`order_views(id uuid pk, workspace_id fk not null, owner_id uuid null fk auth.users on delete cascade, name text 1..60 check, emoji text null ≤8, scope text check in (confirmation,shipping,all), layout text default 'table' check in (table,kanban), config jsonb not null default '{}' check (jsonb_typeof='object' and pg_column_size<4096), position int default 0, created_at, updated_at)`.
- RLS on. SELECT: `workspace_id=current_workspace_id() and (owner_id is null or owner_id=auth.uid())`. INSERT/UPDATE/DELETE: workspace match and (`owner_id=auth.uid()` or (`owner_id is null` and `is_admin()`)); UPDATE has USING + WITH CHECK, and owner_id/workspace_id immutable (trigger) so a view cannot be re-shared by an agent.
- Do not use audit_row (not financial); `set_updated_at` trigger; index `(workspace_id, scope, position)`; unique `(workspace_id, scope, lower(name)) where owner_id is null`, `(owner_id, scope, lower(name))` otherwise.
- Seed: `insert … select` for every workspace plus an AFTER INSERT trigger on `workspaces` (security definer, search_path pinned, execute revoked) via one `seed_order_views(ws)` function; idempotent.
- Checklist: DB.md row, regen types with `--db-url` (not `--local`), RLS test.

## Files
- `src/lib/order-views.ts`: zod `viewConfigSchema`, `parse/serialize` URL params <-> config, pure + unit test. Reuse filter keys of `all/page.tsx`.
- `src/app/(app)/app/orders/_lib/views-data.ts`: list views per scope (session client).
- `orders/views-actions.ts` (colocated actions): create/update/rename/delete/reorder; zod, re-check role in each; shared writes admin only.
- `orders/view-tabs.tsx` (client, uses `TabsNav` pattern, Radix menu for save/rename/delete, field components for name/emoji, Lucide icons) + `saved-view-bar`; mount in the three pages beside `OrderTabs`.
- Pages: resolve `?view` -> config -> apply to query, URL params override the view; invalid/foreign id falls back to default with a notice.
- `messages/{en,ar}.json`; `docs/DB.md`.

## Steps (each pushed)
1 migration+DB.md+types · 2 RLS tests · 3 `order-views.ts` + unit test · 4 actions · 5 tabs on `all` · 6 confirmation · 7 delivery · 8 i18n + screenshots.

## Tests
`order-views.rls.test.ts`: agent cannot read another agent's private view; agent cannot insert/update/delete a shared view or flip owner_id to null; agent edits own; admin edits shared, sees own+shared not agents' private; cross-workspace invisible; seed present for every workspace and for a new one, idempotent; bad scope/layout/oversized config rejected. Unit: config round-trip, unknown keys dropped, junk URL values.

## Screenshots
three pages, admin + agent session, dark+light, EN+AR, 390 px; tabs overflow, save menu, empty views, error state, view link opened in a second session.

## Edge cases / decisions
Deleting the active view; two views same name; many views (tabs scroll). No new DECISIONS row needed: permissions follow the spec and D10; "Callbacks due"/"Kanban" seeds deferred is a plan note only.
