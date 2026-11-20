VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp triage) + ui-reviewer. No production security code changed; nothing attacker-reachable.
Live suites pass (60/60 with LOCAL_SUPABASE_URL set; the RLS file skips silently without it). Exports, trim, placeholder, `satisfies` are correct.
Two medium test-quality gaps: the saveVariantConfig action test was dropped on an inaccurate reason, and the stock-chip render test asserts hand-typed labels that differ from the real EN strings.
Lows: guard-test race and scoping, spare cleanup not in finally, missing dark/AR screenshots.

## Findings (ranked)

1. **Medium** - `src/lib/variants.rls.test.ts:655`, `src/app/(app)/app/products/actions.ts:235-241`.
   Failure: the brief's "Done when" says the test calls `saveVariantConfig` and asserts the refusal. The test was renamed "zod (schema only, the action needs a session)". The action does not need a session for this path: zod failure returns before `createClient()`; only `adminProfile()` needs mocking (pattern: `src/app/(app)/app/products/[id]/pricing/actions.test.ts:19-21`, mocks `@/lib/rbac`, `next/cache`, `@/lib/supabase/server`). Nothing proves the action refuses a value-less size before the RPC. Note `VariantResult` has no `variant_values` code: the action returns `{ ok:false, code:"invalid", error:"variant_values" }`. The test also sits inside `describe.skipIf(!URL)`, so it never runs without the stack.
   Fix: add a unit test outside the live suite calling `saveVariantConfig(PID, { options: [], variants: [sizeWithoutValues] })`. Assert exactly `{ ok:false, code:"invalid", error:"variant_values" }` and that the rpc mock was not called. Correct the PROGRESS note.

2. **Medium** - `src/app/(app)/app/store-1-g.render.test.tsx:77-85`.
   Failure: EN labels are hand-typed `{ out: "Out", low: "Low" }`, but the app renders `en.json:585-586` `"out"` / `"low"` (lowercase; screenshot shows "0 · out"). The test passes against text the app never shows, so it would miss a broken key or label wiring.
   Fix: build the labels from `en.stock.out` / `en.stock.low` (as the AR case does), or via `createTranslator`.

3. **Low** - `src/lib/variants.rls.test.ts:670-688`. The pre-count and the post-count come from separate psql calls outside the guard transaction. `src/lib/store/data.test.ts:43,63,92` briefly commits a value-less size, so the test can flake (false fail, not false pass). Fix: one psql script, `begin isolation level repeatable read;` count, insert, guard, rollback; parse both numbers from that call.

4. **Low** - same test. With pre = 0, a guard that checked only one workspace or the newest row would still pass. Fix: insert a value-less size in both `ws` and `ws2` and expect `pre + 2`.

5. **Low** - `src/lib/variants.rls.test.ts:690-698`. The clean-data case deletes value-less sizes in every workspace. That fails on the NO ACTION FKs (`orders_variant_fk`, `stock_movements_variant_fk`) if any such size is referenced, and it locks other suites' rows. Fix: as the brief offered, run a copy of the guard filtered to `ws` or to a fresh workspace, with no global delete. Also assert that the extracted guard text contains `raise exception`, so an empty slice cannot pass.

6. **Low** - `src/lib/variants.rls.test.ts:637`. The `spare` delete is not in `finally`; an earlier failed assertion leaves the row until `afterAll`. Fix: try/finally.

7. **Low** - `src/app/(app)/app/orders/[id]/page.tsx:145,180`. `showsSizeCell` recomputes `isAdmin && sizes > 0` alongside `showsCard`, so the two can drift. They match today. Optional: derive one from the other.

8. **Low** - `variants-editor.tsx:138`, shot `unnamed-option-390-en-light.png`. The empty value input has no placeholder and shows as a blank box. Fix: add a value placeholder, or log a follow-up.

9. **Low** - `src/app/(app)/app/stock/stock-level-chip.tsx:17`. The label sits after " · " in one text node in RTL, so it can bidi-flip if a label ever starts with Latin text. Fix: wrap the label in `<bdi>`.

10. **Low** - `docs/design/audit/STORE-1-H-ui/`. The brief asked for both themes. Missing: stock EN dark and AR light; unnamed-option in dark and AR. Declared in PROGRESS. Confirm placeholder contrast is at least 4.5:1 in dark.

## Missing tests
- Action-level `saveVariantConfig` refusal with no RPC call (finding 1).
- The unnamed option input keeps `aria-label`; a named option has no fallback placeholder; AR placeholder.
- Stock page wiring of `t("stock.out")` / `t("stock.low")` and the isOut/isLow thresholds into the chip.
- Order page call site (`order.variant ?? ""` fallback).
