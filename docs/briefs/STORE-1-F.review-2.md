VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) + ui-reviewer. Live suites (variants.rls, variants, cash, audit-redact.rls, stock-stages, rls) 158/158 green. Grants, security invoker, pinned search_path, shared advisory-lock key, `in_use` and stale refusals all hold; en/ar parity ok.
One medium: a size with no values can still be created or produced by writing to the tables directly, which blocks every later save (the review-1 #1 state).
Review-1 #1-#4 fixed; #5, #6, #8 still open (low).

## Findings (ranked)

1. **Medium: value-less sizes are possible outside the RPC.** `supabase/migrations/00065_variant_config_hardening.sql:17-21`: the completeness trigger only checks sizes that `exists (... product_variant_values ...)`, so a size with 0 values passes. The 00066 guard (`00066_variant_config_zero_options.sql:58-71`) covers only `save_variant_config`. RLS lets an admin insert and delete on `product_variants` / `product_variant_values` via PostgREST. Reproduced as admin: insert a `product_variants` row with no values, or delete all value rows of an existing size. Both commit (value-less count 0 -> 2). After that the editor loads `values: {}`, the zod check in `src/lib/variants.ts:62-64` rejects every save, and the product's options are stuck.
   Fix: add a deferred constraint trigger on `product_variants` insert that refuses a size with 0 value rows at commit, and make the `product_variant_values` delete path refuse the same. Alternatively, revoke direct insert/delete on those two tables so the RPC is the only writer. Add tests for both paths.

2. **Low: new 40P01 window from the lock in the trigger** (`00065:16`). B deletes a product, so the cascade row-locks options and values. A calls save, takes the advisory lock, then waits on B's rows. B's commit-time trigger then asks for the advisory lock, and the two deadlock. Before 00065, A simply waited. Fix: have the delete-product action take the same lock first, or document the risk as accepted.

3. **Low: a value from the wrong option reports `in_use`.** `00066:66-68` checks the keys but not that each value belongs to its key's option. `{SizeOpt: RedId}` falls through to the FK (`00042:66`), which raises 23503, and `actions.ts:157` maps that to `in_use`. Only reachable through a direct RPC call. Fix: check each value's option = its key in SQL and raise `incomplete size`.

4. **Low: review-1 leftovers.**
   - #6: `variants-editor.tsx:152,159,162,165` value inputs and buttons still use `t("optionName")`, not `optName(o, i)`.
   - #8: `orders.order_seq.rls.test.ts:60` and `zrexpress-sync.test.ts:83` still call `workspaces.delete()` directly, and no follow-up task is logged.
   - #5: the brief's screenshot set is incomplete (see Missing tests).

5. **Low: misleading test name.** `src/lib/variants.rls.test.ts:389` "re-adding a removed label in one save succeeds" actually asserts a 23503 refusal. Rename it to "...while its size still exists is refused".

6. **Low: docs drift.** `docs/DB.md:10` still says stale applies "once a size has values" and does not mention 00066 (stale once any size exists, zero options refused, `values` must be an object). `PROGRESS.md` records neither 00066 nor the review-1 round.

7. **Low (UI): repeated label.** `orders/[id]/variant-card.tsx:64` shows a "Size" heading with an identical visible "Size" field label directly under it. Fix: make the label sr-only, or point the field at the heading with `aria-labelledby`.

8. **Low (UI): minor editor items.** `variants-editor.tsx:271`: the `text-warning` unsaved hint on `bg-card` was not checked for contrast in light theme. Measure it; if below 4.5:1, use `text-muted-foreground` with an icon. `variants-editor.tsx:57`: `toggleActive` calls `dirty()`, which is defined further down. Hoist it for clarity.

Follow-up (outside this diff, log a task): 00042 grants `authenticated` TRUNCATE, TRIGGER and REFERENCES on the four variant tables. 00049 revokes these on `stores`; do the same here.

## Missing tests
- A size inserted directly with no values, or a size whose value rows are all deleted, is refused at commit.
- A wrong-option value through the RPC returns `incomplete size`.
- 00066 stale rule: adding an option once a value-less or any size exists is refused.
- Screenshots per brief: dark + light, EN + AR, 1280 + 390 for order detail with a sized product (Size card position, one label), product edit, `/products/new`, stock hub "Count needed" pill, count-by-size. Only 390 px partial sets exist today. Review-2 shots are in `docs/design/audit/STORE-1-F/r2-*.png`.
- No logged evidence of `scripts/gate.sh --fast` green 3x in a row.
