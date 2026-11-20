# CONF-1 brief (rev 1, after review-0) — saved order views (table), URL state, seeded shared views
risk: high · surface: ui · lane: orders (M: migration 00056; 00051 is parked on STORE-3, so 00056 applies before it on a remote push: tell the owner)

Goal: confirmation / delivery / all-orders pages show a views strip; a view = saved filters + sort (+ stored columns), state in the URL, shared views seeded.
Defaults for review-0 "Choices" (recommended ones, `/decide` may overturn): seed_key translated names; deleted/renamed seeds stay gone; only shared views linkable by id; "Today confirmed" DEFERRED (no confirmed-at column; needs a history join, goes to CONF-4); agents get personal views on every scope; cap 20 views per scope+owner-kind.

## Done when
- `order_views` + RLS: user reads shared + own; writes own; only admin writes shared; agent cannot read others' private or write shared; anon nothing.
- Seeds (all shared, with `seed_key`): `new` (confirmation_status=wait_for_confirmation; scope confirmation) · `no_answer` (closed phone / no answer statuses; confirmation) · `duplicates` (duplicates=1; all). Delivery gets none yet. Names shown from messages until renamed. Seeded per workspace by backfill + trigger on workspaces only: a deleted seed never returns.
- Default tab (no `?view`) always first, undeletable; confirmation = `ACTIONABLE_CONFIRMATION` queue.
- Page fixed filters stay: delivery keeps `.eq(confirmation_status,'confirmed')`; confirmation view status may only narrow within non-confirmed statuses.
- Layout table only: `kanban` rows ignored until CONF-2. `config.columns` is stored, not applied (no chooser yet).
- Gate green with live RLS suite (D24); en/ar parity.

## Migration 00056_order_views.sql (checklist: workspace_id FK on delete cascade · RLS · set_updated_at · DB.md · types · RLS test)
`order_views(id, workspace_id not null refs workspaces on delete cascade, owner_id null refs auth.users on delete cascade, seed_key text null, name text check (char_length(btrim(name)) between 1 and 60), emoji text null check (char_length<=16), scope check in (confirmation,shipping,all), layout default 'table' check in (table,kanban), config jsonb default '{}' check (jsonb_typeof='object' and octet_length(config::text)<4096), position int default 0, timestamps)`. One position sequence per (scope, owner-kind); shared first in UI.
- `revoke all … from anon`; SELECT `workspace_id=current_workspace_id() and (owner_id is null or owner_id=auth.uid())`; INSERT/UPDATE/DELETE workspace match and (`owner_id=auth.uid()` or (`owner_id is null and is_admin()`)); UPDATE has USING + WITH CHECK.
- Immutability trigger on UPDATE: `owner_id IS DISTINCT FROM old` or `workspace_id IS DISTINCT FROM old` raises (admin flip refused both directions).
- Indexes: `(workspace_id, scope, position)`; unique `(workspace_id, scope, lower(name)) where owner_id is null`, `(owner_id, scope, lower(name)) where owner_id is not null`; unique `(workspace_id, seed_key) where seed_key is not null`.
- `seed_order_views(ws)` SECURITY DEFINER, search_path pinned, idempotent on seed_key; `revoke execute … from public, anon, authenticated` (pattern 00021:43-44). Separate trigger wrapper function on `workspaces` AFTER INSERT (00050 pattern), also revoked. One-time backfill `select seed_order_views(id) from workspaces` in the migration.
- Types: generated from the local stack with `--local` (project rule; never `--linked`), note it in PROGRESS.

## Files
- `src/lib/order-views.ts` (+ test): `viewConfigSchema` typing every value (uuid regex, status enums, wilaya int range, ISO date, `__all` cleared marker, `sort` from the shared allow-list, `q` via `sanitizeOrderTextQuery`), parse/serialize URL<->config, effective-config merge (URL overrides view, `__all` removes a view filter), dirty = normalized params differ from view, ignoring `page`. Use code names: `confirmation_status`, `product_id`, `wilaya_code`.
- `orders/_lib/order-query.ts`: ONE shared query builder for all 3 pages (moves SORT_COLUMNS and the `.or()` logic out of `all/page.tsx:70-87`); page's fixed filter applied last. Add a row-limit notice where 1000 can cut a list.
- `orders/_lib/views-data.ts`: list views per scope (session client); on failure return `{error}` so the page still renders Default + "Could not load views" with Retry.
- `orders/views-actions.ts`: create/update/rename/delete/reorder; zod; role re-check; `owner_id`/`workspace_id` set server-side; every UPDATE/DELETE uses `.select()` and requires exactly 1 row else returns error (RLS 0-row case); 23505 -> duplicate-name message; enforce cap 20; last write wins (documented); after create `router.replace` to new `?view`.
- `orders/view-tabs.tsx` (client, NOT `TabsNav`: that is admin-only and server): `<nav aria-label="Views">` of links with `aria-current="page"`, a second-level pill strip in the toolbar row under `OrderTabs`; shared group first with Lucide `Users` icon + aria-label, separator, personal group; menu trigger beside each link (not inside `<a>`), name in its accessible label; Radix menu: Rename, Delete (`DeleteButton` confirm), Move earlier/later (RTL-logical). Agents: no menu on shared views, only "Save as mine". Horizontal scroll, active in view, edge fade mirrored in RTL, tap targets >=44px mobile, names in `<bdi>`.
- `orders/saved-view-bar.tsx`: shown only when dirty: dot + text "Modified", Save / Save as / Reset. Save-as dialog: name field with 60 counter, emoji field (1 grapheme, <=16 chars), admin radio shared/personal, inline errors + retry; switching view discards edits (stated in a hint); `role=status` live region for Saved/Reset; Escape returns focus to trigger; after deleting the active view focus goes to Default.
- Pages `all`, `confirmation`, `delivery`: resolve `?view` (valid uuid, scope match, shared or own only) else strip it with a dismissible `role=status` notice "That view is not available" (no existence leak; same when active view was deleted). Personal "Copy link" writes the full effective config into the URL. Changing filters resets `page`. Suspense skeleton of 3 pills; empty personal group shows "Save current filters as a view".
- i18n keys (en+ar): views, default, shared, personal, modified, save, saveAs, saveAsMine, reset, rename, delete, deleteConfirm, moveEarlier, moveLater, nameLabel, emojiLabel, duplicateName, capReached, notAvailable, loadError, retry, emptyPersonal, saved, resetDone, seed names (new, noAnswer, duplicates), limitNotice. `docs/DB.md` row.

## Steps (each committed and pushed)
1 migration + DB.md + types · 2 RLS tests · 3 `order-views.ts` + unit tests · 4 shared query builder (behavior-preserving, `all` first) · 5 actions + tests · 6 `view-tabs`/bar on `all` · 7 confirmation · 8 delivery · 9 i18n + screenshots.

## Tests (by name)
`order-views.rls.test.ts`: anon reads nothing; agent cannot read another's private view; agent insert/update/delete on shared = refused or 0 rows; agent owner_id->null refused; admin owner flip refused both ways and workspace_id change refused; agent edits own; admin sees shared + own only; cross-workspace invisible; seed present for existing and a new workspace, idempotent by seed_key, deleted seed not recreated; authenticated RPC `seed_order_views` refused; bad scope/layout/oversize config/blank name rejected.
Unit: every seed config parses without losing keys; `.or()` injection (`,` `)` `%`) in URL and stored q/agent; unknown sort falls back; junk `?view` (non-uuid, foreign private, other scope); URL overrides incl. `__all`; dirty ignores `page`; duplicate name message; oversize name/emoji rejected; action reports error on 0-row update.
Pages: delivery filters confirmed whatever the view; agent opening admin `?view` on `all` sees only agent-visible orders.
UI: keyboard path through strip and menu incl. Escape; agent sees no edit menu on shared; focus after delete.

## Screenshots (docs/design/audit/CONF-1/; both themes, EN+AR)
views row under OrderTabs (admin, agent) · dirty bar · name dialog with duplicate error · delete confirm · shared/personal groups · AR with Latin-named view · 12+ views at 390px RTL · invalid-view notice · error and empty states.

## Edge cases / status
Deleting the active view; same name in shared and personal; two edits colliding (last wins). Assumptions confirmed: no `order_views`/`callback_at` exist; filter keys per `all/page.tsx`. Stale: spec's "Today confirmed" and "Callbacks due" seeds (deferred to CONF-4). No new DECISIONS row required unless `/decide` overturns a default above.

## MERGE PLAN (rev 2, D89; supersedes build steps above, build is done on `v3-CONF-1`, review-4 ESCALATE, Q-18)
Task now = merge, no new feature code, no round 5. Orders moved to `app/sell/orders` and `shipping` on v3.
1. Claim, `git checkout v3-CONF-1`, `git merge v3`. Conflicts (found by dry run): `sell/orders/(list)/page.tsx`, `orders-filter-bar.tsx`, `sell/shipping/page.tsx`, `messages/{en,ar}.json` (keep both key sets). Move the branch's `app/orders/_lib/{order-query,views-data}(.test).ts` and other `app/orders/*` files to `app/sell/orders/`. Delivery page is now `sell/shipping`.
2. Migrations 00056/00057 do not collide (v3 has 00055, 00058+). Remote push needs `--include-all` because 00058-00077 are newer: tell owner, never push. Regenerate types locally (`--local`) only if the merge breaks them.
3. Run `scripts/gate.sh` with live RLS suite; fix only merge breakage. Never edit gate or tests.
4. Add ONE follow-up row `CONF-1-F` to MASTER_PLAN with the 2 open mediums: (1) status lost when typing during load, fix `search-param-sync.ts:58` build from `sent.at(-1) ?? lastQs`; (2) `hold()` too broad/narrow (`search-param-input.tsx:49-60`; cancel on link click, Save via box handle). Lows (Save not cancelling write, `pairKey` collision, slow nav outlasting hold, misleading empty state) go to `docs/BACKLOG.md`.
5. Mark Q-18 answered by D89 in QUESTIONS.md; tick CONF-1; unblocks CONF-2/3/4, NAV-4-V.
Risk stays high (RLS/migration); surface ui: screenshots already exist under `docs/design/audit/CONF-1/`; re-screenshot only if the merge touched the views UI.
