# STORE-1-G brief
risk: high · surface: ui,security · lane: store

Goal: close the eight lows of STORE-1-F review-3 (DB hardening, test deadlock root cause, small UI fixes, missing tests, full screenshots).
Spec: docs/specs/STORE.md; D54, D55, D56(3). Migration next number: 00068 (latest is 00067).

## Done when
- A signed-in admin cannot change `value_id`/`option_id` of an existing `product_variant_values` row (test).
- `authenticated` has no TRUNCATE/TRIGGER/REFERENCES on the four variant tables (test via has_table_privilege).
- Migration raises (or `raise warning` with count, owner decides) if a product holds a value-less size from service_role.
- stock-stages tests re-run 00029 for their own workspace only; no cross-workspace scan.
- docs/DB.md records the delete-vs-save 40P01 window and drops the "Known: TRUNCATE" sentence.
- EN/AR move-option labels read right when the option is unnamed; stock pill never wraps at 390; "Size" shown once on order page; AR wilaya wrapped in `<bdi>`.
- Rendered tests exist for the new strings and accessible names; screenshot matrix done; `scripts/gate.sh --fast` green 3 runs in a row.

## Files and changes
1. `supabase/migrations/00068_variant_values_hardening.sql` (hand-numbered, no new table so checklist = RLS unchanged):
   - `revoke truncate, trigger, references on public.<4 tables> from authenticated` (copy loop of 00049:68).
   - BEFORE UPDATE trigger on `product_variant_values`: raise if `new.value_id <> old.value_id or new.option_id <> old.option_id or new.variant_id <> old.variant_id` (apply to all roles, except none needed: service_role tests only insert). Function revoked from public/anon/authenticated, search_path pinned. Prefer trigger over revoking UPDATE (keeps column-level future flexibility; update policy stays).
   - `do $$` guard: count variants with no value rows whose product has options; if > 0 `raise exception` naming count and the fix (delete or give them values) so the owner's `db push` stops. Local has none.
2. `src/lib/stock-stages.test.ts` lines ~324-329 and ~420-428: do not run the 00029 file. Replace the `psql` of the whole file with a statement scoped to the test workspace: `do $$ declare r record; begin for r in select id from orders where workspace_id='<ws>' and product_id is not null loop perform stock_reconcile_order(r.id,null,'order_stock_sync',null); end loop; end $$;` (helper `reconcileWs(ws)`). Same assertions. Do not delete or weaken tests (D56 3). Also check kpi.test.ts for the same hazard (note only).
3. `docs/DB.md` row at line 57: remove "Known: 00042 grants ..."; add 00068 and the 40P01 window (direct product delete concurrent with `save_variant_config` takes row locks then advisory lock, reverse order; no screen deletes products; accepted).
4. `src/messages/{en,ar}.json` (~line 1323): `optionFallback` becomes `#{n}` in both (check AR parity); the move/remove strings then read "Move option #1 up". Verify no other use of optionFallback reads badly (variants-editor.tsx:64).
5. `src/app/(app)/app/stock/page.tsx` ~line 92: add `whitespace-nowrap` to the level pill.
6. `src/app/(app)/app/orders/[id]/page.tsx`: drop the summary-grid "Size" cell, keep card heading (find with grep on the size label).
7. Same file: wrap wilaya name in `<bdi>` (query at line 45, render of `wilaya`).
8. Tests: `src/lib/variants.rls.test.ts` add: update value_id refused; has_table_privilege false; admin product delete still commits; save on product with service_role value-less size returns failure (insert as svc). New rendered test file for variants-editor (accessible names with unnamed option, `role="alert"` on stale result, unsaved hint) and stock "Count needed" pill, following existing render-test conventions in repo (grep `*.test.tsx`).

## Steps (each committed with scripts/step.sh)
1 migration 00068 + variants.rls tests; 2 stock-stages scoping; 3 DB.md; 4 i18n + stock pill + order page + bdi; 5 rendered tests; 6 screenshots; 7 gate --fast x3, PROGRESS.md.

## Screenshots (browser MCP, docs/design/audit/STORE-1-G-ui/)
Order detail: EN light, AR dark 390, AR dark 1280 (wilaya bdi, one "Size"). Product edit with unnamed option EN+AR. Stock hub 390 EN dark (pill one line). Stale message state (two sessions: save in A, then save in B).

## Edge cases / assumptions
- Verified: 00067 is latest; 00029 is a global loop over all orders (cause of 40P01) so scoping must be done in test SQL, the migration file stays untouched.
- Trigger must not block the save function: it only upserts existing sizes' sku/is_active and deletes/inserts values, never updates value_id (confirm in 00067 save body before coding).
- Migration guard raising may fail local reset if seeds create value-less sizes: check seed first; fall back to `raise warning`.
- No new DECISIONS row needed; the guard raise vs warn is covered by the review's "raise or warn".
