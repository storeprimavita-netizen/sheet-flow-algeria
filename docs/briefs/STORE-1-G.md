# STORE-1-G brief (rev 1, after review-0 FIX)
risk: high · surface: ui,security · lane: store

Goal: close the eight lows of STORE-1-F review-3 (DB hardening, test deadlock root cause, small UI fixes, missing tests, screenshots).
Spec: docs/specs/STORE.md; D54, D55(4), D56(3). Migration number: **00070** (latest is 00067; unmerged v3-VAR-1 uses 00068, v3-CHART-1 uses 00068+00069; a shared local DB skips a repeated version). At ship, `ls supabase/migrations` on v3 and renumber to max+1 if taken.

## Done when
- No role can change any column of an existing `product_variant_values` row, incl. via PostgREST `.upsert()` (ON CONFLICT DO UPDATE) (tests).
- `authenticated` lacks TRUNCATE/TRIGGER/REFERENCES on the four variant tables and still has SELECT/INSERT/UPDATE/DELETE (has_table_privilege both ways).
- Migration guard refuses a value-less size anywhere (any product, with or without options).
- stock-stages tests re-run 00029's own loop scoped to their workspace; no cross-workspace scan.
- docs/DB.md records 00070 and the delete-vs-save 40P01 window; "Known: TRUNCATE" sentence removed.
- Unnamed option reads "Option 1" style in EN and AR in every string; stock pill is one line at 390; order page shows size once for admin and still shows it to agents; AR wilaya code/name order correct.
- Rendered tests for the new strings; screenshots done; `scripts/gate.sh --fast` green 3 runs.

## Files and changes
1. `supabase/migrations/00070_variant_values_hardening.sql` (no new table; RLS unchanged):
   - `revoke truncate, trigger, references ... from authenticated` on the 4 tables (loop as 00049:68).
   - BEFORE UPDATE trigger on `product_variant_values`: `if row(new.*) is distinct from row(old.*) then raise` (all columns are identity). Function security definer not needed; revoke execute from public/anon/authenticated; `set search_path = ''`. save_variant_config never UPDATEs this table (confirmed by review; recheck 00067 body).
   - `do $$` guard between `-- guard:begin` / `-- guard:end`: count ALL variants with no value rows (no "product has options" filter); if > 0 `raise exception` with count and fix. Seed check first; if seeds create any, fall back to `raise warning`.
2. `src/lib/stock-stages.test.ts` ~324-329, ~420-428: read the 00029 file, add `and workspace_id = '<ws>'` to its loop select, run that text (helper `reconcileWs(ws)`). Same assertions, none weakened. Note (no change): `variants.rls.test.ts:174` re-runs 00043 over all workspaces; kpi.test.ts check for the same hazard.
3. `docs/DB.md` ~line 57: drop "Known: 00042 grants ..."; add 00070 + 40P01 window (direct product delete vs `save_variant_config`: row locks then advisory lock, reverse order; no screen deletes products; accepted).
4. i18n `src/messages/{en,ar}.json` ~1323: keep `optionFallback` localized and noun-based so templates stay readable: EN "Option {n}" (was "option {n}", causing "Move option option 1 up"), AR "الخيار رقم {n}". Then `moveOptionUp` etc. read "Move option Option 1 up": so change the templates to take a name that already carries the noun when unnamed: simplest is `moveOptionUp` -> "Move {name} up" (EN) / "نقل {name} للأعلى" (AR) and same for remove/addValue/valueNumbered, with named options shown as `option "Color"`-style via a second key `optionNamed` ("Option {name}"). Choose one approach in code; assert exact strings in EN+AR. Consumers: variants-editor.tsx:64 `optName`, sr-only legend, addValue, valueNumbered, removeValue (:128,152,178).
5. Stock pill: reproduce at 390 FIRST. `stock/page.tsx:83` count-needed link already has `whitespace-nowrap`; the wrapping pill is probably the level Chip at ~:92. Put the class there (not on the Chip base unless every chip is checked).
6. `orders/[id]/page.tsx:185`: `const showsCard = isAdmin && productSizes.length > 0` (line ~218); render the Meta "Size" cell only when `order.variant && !showsCard`. Agents and legacy text-only variants keep seeing the size.
7. Same file :202: render `<span className="num">{code}</span>-<bdi>{name}</bdi>` (explicit order), not one string.
8. Presentational extraction (D55(4): only `renderToStaticMarkup`, no jsdom): pull small pure components taking state as props: variants-editor stale `role="alert"` message, unsaved hint, order-page size/wilaya cell. Render in tests with `NextIntlClientProvider` + real en/ar messages (conventions: `src/components/stats/rate-bar.test.tsx`).
9. Tests in `src/lib/variants.rls.test.ts`: update of value_id/option_id/variant_id refused; `.upsert()` conflict path refused; privilege checks both ways; admin product delete still commits; value-less size from service_role: assert via `saveVariantConfig` the zod code `variant_values` (variants.ts:61-64). The RPC itself does NOT refuse (SKU-only save commits; save with values fills them), so do not assert RPC failure. Guard test: begin/rollback psql like `cash.test.ts:79`. Rendered tests: unnamed-option accessible names EN+AR, stock "Count needed" pill, stale alert, unsaved hint, agent sees size / admin sees "Size" once, AR wilaya markup order.

## Steps (each via scripts/step.sh)
1 migration + variants.rls tests; 2 stock-stages scoping; 3 DB.md; 4 i18n + stock pill + order page + bdi; 5 extracted components + rendered tests; 6 screenshots; 7 gate --fast x3, PROGRESS.md.

## Screenshots (docs/design/audit/STORE-1-G-ui/)
Order detail: EN light, AR light, AR dark 390 and 1280, EN 390 agent view. Product edit with unnamed option: EN+AR, 390+1280, both themes. Stock hub: 390 EN dark, AR 390, light. Stale message: one per locale (save in session A, then B).

## Edge cases / assumptions
- 00029 is a global loop over all orders (cause of 40P01); migration file untouched.
- Merge conflicts expected with VAR-1 (variants-editor.tsx, variants.rls.test.ts tail, en/ar.json, DB.md); VAR-1 only inserts value rows, compatible with trigger and guard. CHART-1 untouched.
- No new DECISIONS row needed.
