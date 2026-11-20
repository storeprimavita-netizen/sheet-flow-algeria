# STORE-1-H brief
risk: low · surface: ui,security · lane: store

Goal: close the lows of STORE-1-G review-2 (2-7) and review-3 (1-7): test-quality fixes, two tiny UI fixes, retaken screenshots. No migration, no DB change.
Spec: docs/specs/STORE.md; D54, D55(4) (renderToStaticMarkup only, no jsdom), D56(3). No new DECISIONS row. Risk low because no production security code changes (tests + presentational code); security surface only because tests cover RLS/grants.

## Done when
- Guard test (`src/lib/variants.rls.test.ts:665`) cannot false-pass: `spare` (value-less size at :617) is deleted at the end of its test; guard transaction asserts reported count == pre-count + 1 (count read via psql before); a clean-data case (no value-less sizes, in a rolled-back txn that deletes them or scoped workspace) expects no throw.
- The :653 test calls `saveVariantConfig` (src/lib/variants.ts:61-64) and asserts code `variant_values`; if the action needs a session mock too heavy, rename the test to "zod" and say so in PROGRESS.
- Render tests import the REAL code: `showsSizeCell(isAdmin, sizesCount, variant)` and `StockLevelChip` are exported (not copies); `VariantsEditor` rendered with a cleared and a whitespace-only option name.
- Whitespace-only option name behaves as unnamed; unnamed option input has `placeholder={optionFallback}`; `as never` replaced by `satisfies VariantResult`.
- Screenshots retaken (see below); `scripts/gate.sh --fast` green.

## Files and changes
1. `src/app/(app)/app/orders/[id]/order-meta.tsx`: add `export function showsSizeCell(isAdmin, sizesCount, variant): boolean` = `!!variant && !(isAdmin && sizesCount > 0)`. `page.tsx:145,180`: `showsCard` stays for the card; the Meta cell uses `showsSizeCell(isAdmin, productSizes.length, order.variant)`.
2. `src/app/(app)/app/stock/`: extract `StockLevelChip({stock, isOut, isLow, labels})` (new `_components/stock-level-chip.tsx` or beside page; page.tsx:90-93 uses it, keeps `whitespace-nowrap`). Thresholds isOut/isLow stay computed in the page (do not re-derive formula; just pass).
3. `variants-editor.tsx`: `optName` (:65) uses `o.name.trim()`; key choice at :122,125,128 uses `o.name.trim() ?` too; unnamed Input (:114-120) gets `placeholder={t("optionFallback", {n: i+1})}`. The input keeps its `aria-label`.
4. `src/app/(app)/app/store-1-g.render.test.tsx`: drop the local `showCard`/Chip-class copies (:70-86); test `showsSizeCell` (admin+sizes false, agent true, admin with 0 sizes + legacy text size true, null variant false), `StockLevelChip` at stock 0 / low / ok (en+ar text, `whitespace-nowrap` present from the real component), `WilayaValue` with code null and "" (name only, no dash), VariantsEditor render with name "" and "  " (aria-labels use the unnamed keys, EN+AR, placeholder present), named option name "Size" gives "Remove option Size". Replace `as never` (~:303) with `satisfies VariantResult`. Conventions: `src/components/stats/rate-bar.test.tsx`.
5. `src/lib/variants.rls.test.ts`: guard + saveVariantConfig changes above; add optional test `anon` and `PUBLIC` lack TRUNCATE/TRIGGER/REFERENCES on the four tables (`has_table_privilege('anon', ...)`, same psql helper as :639).

## Steps (each via scripts/step.sh)
1 variants.rls tests (guard count + clean case, saveVariantConfig, spare cleanup, anon grants); 2 exports (`showsSizeCell`, `StockLevelChip`) + page wiring; 3 editor trim/placeholder + tests; 4 render tests rewrite; 5 screenshots + PROGRESS.md; 6 gate --fast.

## Screenshots (docs/design/audit/STORE-1-H-ui/, run local app, both themes; note in PROGRESS)
Product edit EN light full 1280 page (replace the 960x406 crop; do not crop). Stock hub at 390 EN + AR with two seeded products at stock 3 (Low) and 0 (Out) so the chip renders narrow (seed via psql/service role locally, revert after). Product edit with an unnamed option: placeholder visible, EN 390 light.

## Edge cases / assumptions
- Verified live code: showsCard (page.tsx:145), WilayaValue already null/"" safe, optName :65, chip :90 exist as the reviews describe; 00070 unchanged and no migration number needed (latest 00070).
- Guard test shares the DB with parallel suites: assert count relative to the pre-count read in the same psql call, not absolute; the clean case must delete value-less sizes only inside the rolled-back txn and scope to `ws`, or run the guard SELECT with a `workspace_id` filter copy; do not weaken the migration text.
- Owner awareness (no change): remote `db push` of 00070 aborts if value-less sizes exist; run the guard's `select count(*)` first.
- Merge risk low: VAR-1 touches variants-editor.tsx and tests tails; keep edits small.
