VERDICT: FIX

## Summary
Brief review (qa-reviewer + ui-reviewer). The DB design is sound: the BEFORE UPDATE trigger and the revokes don't break save_variant_config (it never UPDATEs product_variant_values), cascades, or service_role tests. VAR-1 and CHART-1 don't conflict with the trigger, the revokes or the guard.
Before building, fix these: the order-page "Size" removal hides the size from agents, migration 00068 is already used by both unmerged branches, one planned RPC test asserts behaviour that doesn't happen, and the planned stale/unsaved rendered tests can't be written with renderToStaticMarkup.

## Findings (ranked)

### High
1. **Order page: removing the Size cell hides the size from agents.** `src/app/(app)/app/orders/[id]/page.tsx:185-189` (Meta cell, all roles) vs `:218` (VariantCard, only `isAdmin && productSizes.length`). Failure: confirmation/delivery agents never see the size. Neither does anyone on legacy orders that only have a text `order.variant`. Fix: `const showsCard = isAdmin && productSizes.length > 0` and render the Meta cell when `order.variant && !showsCard`. Test both branches: an agent sees the size, and an admin with sizes sees "Size" exactly once.

### Medium
2. **Migration number collision.** `v3-VAR-1` adds `00068_variant_options_swatches.sql`. `v3-CHART-1` adds `00068_chart_series.sql` and `00069_chart_series_review.sql`. The shared local DB records applied migrations by version number only, so whichever 00068 is applied first makes the others count as already applied, and they are silently skipped. Fix: use `00070_variant_values_hardening.sql`. At ship time, re-check `ls supabase/migrations` on v3 and renumber to max+1 if needed (whoever merges later renumbers).
3. **Planned RPC test "save with a service_role value-less size returns failure" is wrong.** Verified on the local DB: an admin save that only changes SKU commits, because no deferred trigger fires on the ON CONFLICT DO UPDATE path. A save that gives the size its values also commits, because the function fills value-less sizes. The real refusal is zod in `src/lib/variants.ts:61-64` (`variant_values`). Fix: test through `saveVariantConfig` and assert that error code. If the RPC is tested too, list which cases pass and which fail.
4. **Rendered tests for the stale `role="alert"` and the unsaved hint cannot be written as planned.** The repo only has `renderToStaticMarkup` (D55(4): no jsdom/testing-library), and both states need interaction. Fix: extract small presentational components that take the state as props and render those. Do the same for the order-page size/wilaya cell, because the page is an async RSC with Supabase queries. Render with `NextIntlClientProvider` and the real en/ar message files.
5. **Stock pill fix may target the wrong element.** `src/app/(app)/app/stock/page.tsx:83` (the "Count needed" link) already has `whitespace-nowrap`. The stock-level Chip at ~:92 is a different pill. Fix: reproduce at 390px first (before/after screenshots) and put the class on the pill that actually wraps. If you change the `Chip` base instead, check every other chip for overflow.
6. **AR wilaya `<bdi>`.** `page.tsx:202` renders `` `${code}-${name}` `` as one bidi run. A `<bdi>` around the name alone, or the whole string, can still show "Tlemcen-13" / "الجزائر-16" in RTL. Fix: `<span className="num">{code}</span>` + separator + `<bdi>{name}</bdi>` (or an explicit `dir`). The AR screenshot must show the code→name order is correct.

### Low
7. **The guard counts too little.** Limiting it to sizes "whose product has options" misses value-less sizes on products with no options, which also block every save (`variants.ts:53` zod, and the 00067 trigger). Count every value-less size. Add `-- guard:begin/end` markers and a begin/rollback psql test like `cash.test.ts:79`.
8. **`#{n}` fallback reads badly elsewhere.** `optName` also feeds the sr-only legend, `addValue`, `valueNumbered` and `removeValue` (`variants-editor.tsx:128,152,178`), giving "Add value to #1" and "Value 1 of #1". In AR a lone `#1` is bidi-neutral and can flip. Fix: keep a localized `optionFallback` (AR "الخيار رقم {n}"), or wrap the name in LRI/PDI. Assert the exact accessible names in EN and AR.
9. **Trigger hardening.** Every column of product_variant_values is identity, so refuse `row(new.*) is distinct from row(old.*)` instead of listing columns. Add tests for the PostgREST `.upsert()` (ON CONFLICT DO UPDATE) path, plus positive `has_table_privilege` checks that SELECT/INSERT/UPDATE/DELETE are still granted, so an accidental `revoke all` fails the test.
10. **stock-stages test.** Scoping is sound, but build the scoped SQL from the 00029 file itself (read the file and add `and workspace_id = '<ws>'`) so the test still runs that file's loop. The 00043 re-run at `variants.rls.test.ts:174` has the same all-workspaces loop: note it.
11. **Screenshot matrix gaps.** Add AR light and an EN 390 agent view for order detail. For product edit with an unnamed option, cover both widths and both themes. Add one shot per locale of the stale state, and AR 390 plus light for the stock hub. Save to `docs/design/audit/STORE-1-G-ui/`.

## VAR-1 / CHART-1 interaction
- Number collision: yes (finding 2).
- VAR-1 only INSERTs product_variant_values rows (backfill guarded by `not exists`). Its `kind_clear` trigger updates product_option_values, not product_variant_values. It never changes value_id/option_id/variant_id, so the new trigger is compatible. It doesn't touch the grants on the four tables, and its flow never creates value-less sizes, so the guard is unaffected in either merge order.
- CHART-1 touches no variant table.
- Merge order: expect text conflicts in `variants.rls.test.ts` (tail), `variants-editor.tsx` (rewritten by VAR-1), `en/ar.json` and `docs/DB.md`. If VAR-1 merges first, the new variants-editor render test needs VAR-1's props.

## Missing tests
- Agent view of the order page still shows the size; an admin with sizes sees it once.
- Guard test (begin/rollback).
- Action-level value-less save (zod code).
- Upsert path blocked by the trigger, plus positive grants still present.
- Exact unnamed-option accessible names in EN and AR, including legend/addValue.
- AR wilaya markup order.
- Stale/unsaved messages rendered via extracted components (`role="alert"`).
