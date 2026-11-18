VERDICT: ESCALATE

## Summary
Round 4, the last round D55 allows. The D55 (1)–(4) work is done: `save_variant_config` is one security-invoker transaction, the database refuses incomplete sizes, the save action is one `rpc`, `stale` has EN and AR messages, and focus comes back after the dialog closes (EN and AR). No high findings. There is one medium: the gate is flaky because of a deadlock between two test files. 2 of 4 `--fast` runs failed and both full runs passed; the RLS suite ran live, 473/473.
The verdict is ESCALATE by rule (n ≥ 3, not PASS). Under D55, a passing gate with no high finding means a merge under D40; whatever this review leaves open goes into `STORE-1-F`.

## Findings (ranked)

1. **Medium (test infra, flaky gate): `src/lib/variants.rls.test.ts:101`, the `afterAll` workspace delete.**
   - Gate runs: `--fast` OK, FAILED, FAILED, OK; full runs OK, OK.
   - Both failures were `40P01 deadlock detected` in this hook, and every assertion passed in those runs.
   - The other side of the deadlock is the `00029_stock_reconcile_existing.sql` block that `src/lib/stock-stages.test.ts:327` and `:423-427` re-run. That block loops over every order in every workspace.
   - Vitest runs test files in parallel. The global loop and the cascaded workspace delete lock order rows in opposite orders.
   - The hazard was already there before STORE-1 (`kpi.test.ts` and `stock-stages.test.ts` also delete workspaces). STORE-1 added one more file that does the same, and every deadlock seen involved it.
   - The builder's unexplained `GATE FAILED` has the same Postgres log signature (22:07:20).
   - Fix: retry the cleanup delete once on `40P01`, which weakens no assertion. Longer term: limit the 00029 re-run to the test's own workspace, or serialize the live suites. `vitest.config.ts` is protected, so changing it is the owner's call.

2. **Low: `supabase/migrations/00048_save_variant_config.sql:8-24`, the completeness trigger does not take the per-product advisory lock.**
   - Two writers can race:
     - a direct table write (admin over PostgREST, or service role) that adds option O2 plus a value for the only size;
     - an `rpc` save that adds a size with only an O1 value.
   - Result: a committed size with 1 value out of 2 options.
   - Worked out from the code, not reproduced.
   - Fix: `perform pg_advisory_xact_lock(hashtext(v_product::text));` at the start of the check.

3. **Low: `00048:87-111`, removing a value and re-adding the same label in one save fails.** The save returns `23505 product_option_values_label_uniq` (shown as `duplicate_value`), because the deletes run after the upserts. Reproduced in a rolled-back transaction. Fix: run the two deletes right after parking the labels, before the upserts.

4. **Low: `00048:93-102`, a direct `rpc` call with `values: {}` creates a size with no values.**
   - Reproduced. This is the state that breaks the editor's loader.
   - It is admin-only and outside the app, so it overlaps `STORE-1-F` ("a size with no values made outside the app").
   - Fix: refuse a new size whose number of keys is not the number of options.

5. **Low: `src/lib/variants.rls.test.ts:478-479`, the "reserved" stage test is mislabelled.** It uses `bureau_deposited`, which is on-road. Reserved means confirmed + `wait_for_deposit`, so a size change at the reserved stage is still untested.

6. **Low (UI): `src/app/app/orders/[id]/page.tsx`, the Size card is at the very bottom of the order page**, below History and Assignment, about 1,500 px of scroll. Fix: place it next to the order summary or product line.

7. **Low (UI): `src/app/app/orders/[id]/variant-card.tsx:62-66`, "Choose a size" appears three times:** as the field label, as the placeholder and as an item in the list. Fix: label the field "Size" and keep the placeholder.

8. **Low (a11y): `src/app/app/products/_components/variants-editor.tsx` (option row).** When an option has no name yet, its buttons read "Remove option " and "Add value to " with nothing after them. Two more points in the same file:
   - Fix for the names: fall back to "option N".
   - The stale message may not be announced to screen readers. Give it `role="alert"`, as `variant-card.tsx` does.

## Verified
- **`save_variant_config`:**
  - It is security invoker, with `search_path = public, pg_temp`.
  - Its steps run in the D55 order: advisory lock with the same key as the duplicate-set trigger, admin and visibility check, stale check, parking, upserts, deletes.
  - Execute is granted to `authenticated` only.
- **Refusals:**
  - stale payload and options left out → `stale`
  - agent → `42501`
  - an id from another workspace → refused by RLS
  - an id from another product → raises
  - `in_use` and the duplicate set roll everything back
- **Completeness trigger:**
  - Service role is refused on a value delete and on an option insert.
  - Deleting an option is also blocked by the NO ACTION foreign key.
  - The 00043 re-run test is unchanged, and no test lines were removed.
- **`saveVariantConfig`** is an admin check, zod, one `rpc` and error mapping. The multi-call save is gone. Types were regenerated and `docs/DB.md` is updated.
- **Focus after the deactivate dialog,** EN and AR: Escape, Cancel and confirm each put focus back on that row's own button. Review-3 #2 is fixed.
- **Stale scenario in two tabs:** the save is refused, the EN message shows, and what was typed stays in the editor.
- **Order-form size picker and change-size card:** checked in dark and light, EN and AR, and at 390 px. Tokens only, no overflow. Screenshots: `docs/design/audit/STORE-1/r4-review-*.png`.

## Missing tests
- A size change at the reserved stage (confirmed + `wait_for_deposit`).
- The `changeOrderVariant` action itself: the current test replays its update and does not call the action.
- A value removed and re-added in one save.
- A new size with an empty values map refused through the `rpc` (if #4 is fixed).

## Not verified
- The stale message in AR in the browser (the string exists in `ar.json:1170`).
- Actually saving a size change on an order (the hold moving to the new size) in the UI.
- An inactive size hidden in the order picker.
- The editor's loading and error states.
- Contrast measured with a tool (only judged by eye).

## For STORE-1-F (per D55)
Findings #1–#8 and the missing tests above. Local test data left behind: product "R4 stale test" (`70a8620d-1eb3-4bf2-96e3-178aef4445ce`).
