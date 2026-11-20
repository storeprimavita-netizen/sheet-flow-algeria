VERDICT: FIX

## Summary
This is review 2, run by qa-reviewer (with the owasp-security triage) and ui-reviewer. No high findings. The qa-reviewer recommends PASS: the database side is correct and both review-1 mediums are fixed. The ui-reviewer recommends FIX for one confirmed medium (accessible names of the option buttons). No owner decision is needed. This file was assembled by the coordinator from the two reviewers' reports, because the review step returned before they finished.

## What was checked
- **Live tests**: variants.rls, stock-stages and store-1-g.render 96/96 with local Supabase; `scripts/gate.sh --fast` once GATE OK (854 passed, 5 skipped).
- **Trigger proof**: in a rolled-back transaction with `product_variant_values_immutable` disabled, a `value_id` change S→L and the `ON CONFLICT DO UPDATE` upsert both went through; with the trigger enabled both fail with "rows are immutable". A no-op update still passes.
- **Database**: no other code path updates `product_variant_values`; every FK on the table is ON UPDATE NO ACTION; `authenticated` keeps only SELECT/INSERT/UPDATE/DELETE; anon has nothing; no value-less sizes locally.
- **Review-1**: #1 (tests prove 00070's trigger), #2 (20-file screenshot matrix), #7, #8, #9 are fixed. #3, #4, #5, #6 are not addressed (lows below).
- **Screens** (from the 20 committed screenshots; no new browser pass): no hardcoded colours, Lucide icons, chevrons mirror in RTL, Latin text in `<bdi>`, no cost or profit shown to agents, the size cell is hidden only when the admin size card shows the size.

## Findings (ranked)

1. **MEDIUM: accessible names of the option buttons lost the word "option"** (`src/messages/en.json:1329-1331`, `src/messages/ar.json:1329-1331`). They now read "Remove {name}", "Move {name} up", "Move {name} down". With a named option a screen reader hears "Remove Size" or "Move Color up", which could mean a value or the whole option. This is the same class as the `removeValue` bug fixed in round 1.
   - Fix: keep "Remove option {name}" and "Move option {name} up/down" for named options, and add unnamed-specific keys for the fallback (as was done with `removeValueUnnamed`), in EN and AR. Add a test with a named option that asserts "Remove option Size".

2. **LOW (raised as medium by the ui-reviewer, not confirmed by it; the qa-reviewer saw it in the files): low / out-of-stock chip at 390 px.** The ui-reviewer opened two screenshots and could not confirm that a low-stock chip is shown at 390 px; the qa-reviewer reports the out/low chips on one line at 390 px in the committed stock shots. Fix: in PROGRESS.md, name the file(s) that show the low and out chips at 390 px in EN and AR; if the AR one does not show it, retake it.

3. **LOW: render tests still partly test copies of the page logic** (`src/app/(app)/app/store-1-g.render.test.tsx`).
   - :300 checks a class the test itself passed to `<Chip>`; it passes even if `stock/page.tsx:90` loses `whitespace-nowrap`.
   - :306 re-implements `show` instead of using the page's `showsCard` (`orders/[id]/page.tsx:143,178`).
   - :263-278 use `createTranslator` and never render the editor's aria-labels.
   - Fix: export a pure `showsSizeCell(isAdmin, sizesCount, variant)` and a `StockLevelChip` from the page code and test those.

4. **LOW: the value-less size test calls zod directly** (`src/lib/variants.rls.test.ts:420-430`): `variantConfigSchema.safeParse` instead of `saveVariantConfig`, so the action-level code `variant_values` (brief item 9) is not asserted. Fix: call the action, or rename the test and note the gap.

5. **LOW: the guard test has no clean-data case** (`src/lib/variants.rls.test.ts:432-441`). It only matches `/\d+ size\(s\)/`; a guard that always throws would still pass, and parallel suites can create value-less sizes. Fix: assert the count is at least the pre-insert count + 1, and add a case that expects no throw on clean data.

6. **LOW: `as never` cast** (`store-1-g.render.test.tsx:284`). Fix: `satisfies VariantResult`.

7. **LOW: `product-edit-en-light-1280.png` is a 960x406 crop of one element**, not a 1280 page.

8. **Owner awareness (no code change):** the 00070 guard uses `raise exception`, so a remote `db push` aborts if legacy value-less sizes exist. Run the guard's `select count(*)` on the remote before pushing.

## Missing tests
- `WilayaValue` with `code={null}` (the review-1 #9 fix is untested).
- Page-level size-cell logic: admin with sizes sees no Meta "Size"; an agent sees it; a legacy text-only variant on a product with no sizes sees it.
- A stock-page level-chip test.
- An accessible-name test with a named option.
- Optional: anon/PUBLIC lack TRUNCATE/TRIGGER/REFERENCES (verified live, not tested).

## Not a finding
- Order detail AR 390: "Tipaza-42" with the code rightmost is the correct logical order in RTL. The Next dev indicator overlapping the Tags card is dev-only.
