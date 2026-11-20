VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) and ui-reviewer. The 00070 database work is correct: trigger, revokes, guard, 00029 scoping and DB.md all check out, and no exploit is reachable.
qa ran variants.rls and stock-stages live (86/86 pass) plus the render test (10/10 pass). `gate.sh --fast` x3 was not re-run.
FIX for two reasons. First, the PostgREST update/upsert tests pass without 00070, because an older trigger refuses them first. Second, only 3 of about 20 screenshots exist, and none shows the unnamed-option state.
Merger's note: the ui-reviewer said the AR wilaya order was wrong. I checked the screenshot: the code "35" is rightmost, so it reads first in RTL. The order is correct; only the file name is wrong (low #7).

## Findings (ranked)

### Medium
1. **The update/upsert tests do not exercise the 00070 trigger.** `src/lib/variants.rls.test.ts:343-346`.
   - The test changes size S to value M while another size already holds M, so the older `product_variant_values_unique_set` trigger refuses it first.
   - qa disabled 00070 in a rolled-back transaction: S→M was still refused, and S→L (a value no size uses) went through.
   - So the svc and admin `.update()` / `.upsert()` assertions would pass without the migration. The Done-when "incl. via PostgREST .upsert() (tests)" is unproven, and the brief's option_id and variant_id cases are missing.
   - **Fix:** use a product with 3 values and 2 sizes. Change a size to the unused value, for both svc and admin, through both update and upsert, and assert `/immutable/`. Add option_id and variant_id change cases.
2. **Screenshot matrix not delivered.** `docs/design/audit/STORE-1-G-ui/` has 3 files.
   - `product-edit-ar-light-390.png` shows an option named "Variant", so the unnamed-option fix is never shown.
   - Missing:
     - order detail: EN light, AR dark at 390 and 1280, EN 390 agent view
     - product edit with an unnamed option: EN, 1280, dark
     - stock: EN dark 390, EN light
     - stale message: one per locale
   - No dark-mode shot exists. No low or out-of-stock level chip is captured, so the Chip `whitespace-nowrap` fix is unverified at 390.
   - **Fix:** capture the full matrix from the brief after the final commit, including an unnamed option and a low-stock chip.

### Low
3. **Render tests are partly tautological.** `src/app/(app)/app/store-1-g.render.test.tsx`.
   - :273 checks for a class the test itself passed to the Chip.
   - :279-286 re-implement the `show` condition instead of using the page's `showsCard` logic (`orders/[id]/page.tsx:143,178`).
   - :236-251 call `createTranslator` and never render the editor's labels.
   - **Fix:** export a pure `showsSizeCell(isAdmin, sizes, variant)` and the stock level-chip component from the page code, and test those.
4. **Value-less size test bypasses `saveVariantConfig`.** `variants.rls.test.ts:368-378` calls `variantConfigSchema.safeParse` directly. The brief asked for the action-level code `variant_values`. **Fix:** call the action and assert the code.
5. **The guard test cannot catch a regression.** `variants.rls.test.ts:380-389`. The guard counts every workspace, and parallel suites briefly create value-less sizes, so the throw can come from their rows. **Fix:** assert the reported count is at least the pre-insert count + 1, in the same transaction. Add a positive case: clean data passes.
6. **`as never` hides a type mismatch.** `store-1-g.render.test.tsx:257`. The cast hides that `error` is missing. **Fix:** use `satisfies VariantResult`.
7. **Screenshot file name is wrong.** `order-ar-light-1280.png` is a 390 px capture. **Fix:** rename it or retake it at 1280.
8. **`removeValue` lost its noun.** `src/messages/{en,ar}.json` `variants.removeValue` is now "Remove {label}" / "حذف {label}", so a named value reads "Remove M". **Fix:** keep "Remove value {label}" / "حذف القيمة {label}"; only the unnamed fallback needed changing.
9. **A null wilaya code renders as "-name".** `orders/[id]/order-meta.tsx:42`. **Fix:** render the dash only when the code exists.
10. **Owner awareness, no change needed.** The 00070 guard uses `raise exception`, as the brief allows. A remote `db push` fails if legacy value-less sizes exist. Run the guard's count on the remote first.

## Missing tests
- PostgREST update and upsert refused by the 00070 trigger alone, with the message asserted (svc and admin), plus option_id and variant_id changes.
- `saveVariantConfig` returning `variant_values`.
- Page-level size-cell logic (admin with sizes: no Meta "Size"; agent: sees size; legacy text-only variant: sees size) and the stock level chip from `stock/page.tsx`.
- Guard regression on the count, and a positive (clean data passes) case.
- Optional: an anon/PUBLIC no-TRUNCATE/TRIGGER/REFERENCES assertion next to the authenticated check. qa verified that anon has nothing today.
