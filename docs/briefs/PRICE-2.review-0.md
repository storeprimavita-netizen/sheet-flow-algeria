VERDICT: FIX

## Summary
Brief review (qa-reviewer + ui-reviewer). Data/RLS/engine direction is sound and 00039 is the right number, but the brief
feeds the engine a per-piece cost as total stock cost, allows cross-workspace product rows, and its diff/validation rules
break D52 and the engine's ranges. The prescribed UI primitives (PercentField, formatUsd) silently clamp/round the very
values this feature needs, and the override-vs-default UX is unspecified. Fix the brief, then build.

## Findings (ranked)

### HIGH
1. **Stock cost unit wrong** — brief l.9 (DoD prefill) / l.44 (pinned test). `product_costs.sourcing_cost_dzd` is per piece
   (dashboards multiply by quantity, 00010:66, 00031:266; `products/[id]/page.tsx:37` calls it `unitCost`), while
   `pricing-v2.ts:298` divides `stockCostDzd` by sellable quantity (benz 81,600 for 50 pcs). 1,632/piece x 50 would give
   ~36 DZD cost/piece instead of 1,813; every recommended price ~1,780 DZD too low. Fix: stockCostDzd =
   `sourcing_cost_dzd x quantity`, recomputed when quantity is edited; pin the component test as 1,632 x 50.
2. **PercentField unusable as-is** — `src/components/fields/percent-field.tsx:24-27,19`. Clamps to 0-100 on blur (markup
   150% destroyed, 1000% cap unreachable), rounds to 1 decimal (0.75% -> 0.8%), reports 0 for empty (override "inherit"
   indistinguishable from 0%). Fix: extend PercentField with `max`, `decimals`, nullable/`allowEmpty` onChange (no fork),
   list it in Files, test it.
3. **USD/DZD display precision** — `src/lib/format.ts:6-24` rounds to whole units. Ad cost 1.5/2.2/2.7 USD shows
   $2/$2/$3; D51 target 1,178.67 shows 1 179. Fix: 2-decimal USD helper (`formatUsd(v,{decimals:2})`) for ad costs and
   USD totals; state DA vs DZD label for the table.
4. **Override-vs-default UX unspecified** — brief Files `pricing-calculator.tsx`. Owner cannot see what is overridden;
   a value equal to default may or may not be stored. Fix: override fields empty with "Default: X" placeholder,
   "Overridden" chip + per-field reset icon button (accessible name), override count on the Advanced header, link to
   `/app/settings?section=pricing`.

### MEDIUM
5. **Cross-workspace product rows** — migration 00039 (Files). Policy checks only the row's `workspace_id`; FK to
   `products` bypasses RLS. Verified on identical `product_costs` pattern: admin of ws A inserted a row for a ws B
   product. With `product_id` as PK a squatted row locks the real owner out (upsert hits an invisible row). Fix:
   composite FK `(product_id, workspace_id) references products(id, workspace_id)` (add `unique(id, workspace_id)`) or a
   BEFORE INSERT/UPDATE mismatch trigger. Test: other-workspace admin insert refused.
6. **"Only changed fields" breaks D52** — `pricing-form.ts` diff. Changing only target value stores `{target:{value}}`;
   `mergeSettings` (pricing-v2.ts ~l.183) then nulls target -> every price "—". Fix: treat `target` as one unit.
   Test: same mode, value changed -> both stored.
7. **One bad key resets all settings** — `src/lib/settings.ts:75`. `getSetting` returns whole DEFAULTS on any parse
   failure; an older/partial row drops all saved values. Fix: deep-partial read schema merged over defaults; strict
   schema on save; target schema discriminated on mode (flat `max(10)` would reject profit 1500). Tests: sparse row keeps
   valid keys; profit 1500 accepted; markup 11 (fraction) refused.
8. **Validation ranges incomplete** — DoD l.11. Engine `inRange` (pricing-v2.ts:289) requires confirm/delivery in (0,1];
   0% or 120% would save and blank every column. Add confirm/delivery (0,100], months/multipliers/fees >= 0, rounding
   from its fixed list; state the unit (percent vs fraction) in each test name.
9. **Markup mode+value control** — D51/D52. Specify segmented control (Profit/piece DZD | Markup % of product cost);
   switching mode resets/converts, never reinterprets; live profit/piece with "—" when cost missing; no per-piece hint
   on Settings ("applied to each product's cost").
10. **Results table tokens/structure** — `<StatusPill>` is bound to order statuses. Use `Chip` with success/warning/
    danger tokens + label + icon (never colour alone); sticky label column, row groups, tabular end-aligned numbers in
    ltr isolates, horizontal scroll at 390 px; below-break-even has a text cue.
11. **"—" vs "Not possible" presentation** — D52. One `<PricingCell>` used by all break-even rows (tested), "—" with
    "missing input" title/aria-label, "Not possible" with icon + explanation text.
12. **Four states / live validity under-specified** — Add `pricing/loading.tsx` (table-shaped skeleton) and
    `pricing/error.tsx` (reason + retry); empty state with "Set stock cost" action while keeping the form; invalid input
    shows inline error, keeps last valid table, disables Save; save pending/success/failure feedback; unsaved-changes cue.

### LOW
13. Final price prefilled from `sale_price` then saved freezes it and kills "empty -> medium recommended"; use it as
    placeholder, store null unless typed; label the source.
14. Quantity not persisted and stock may be 0: state it in helper text (not written back to product) or add a column.
15. Replacing the tab drops the current Real column (`realInputsForProduct`) until PRICE-3: note in PROGRESS or keep.
16. Migration: `check (jsonb_typeof(overrides)='object')`; name ad columns `ad_*_usd`; audit `row_id` null (no `id`) —
    accept knowingly.
17. Settings is a NAV_SECTIONS section (`?section=pricing`), not a tab; Reset needs a confirm dialog; "Using built-in
    defaults" note when never saved; related link to the product Pricing tab.
18. Keep the existing h2 under the product header (no second h1/PageHeader); page itself re-checks admin.
19. AR strings for best/medium/worst, "Not possible", break-even rows; `%` suffix and number alignment in RTL; segmented
    control order.

## Missing tests
- Composite-FK / cross-workspace insert refused; agent update/delete affect 0 rows.
- `saveProductPricing` rejects non-UUID / other-workspace product id; agent refused.
- Empty override field -> inherit (not 0); do not reuse `num()` from `settings/actions.ts:18` (coerces "" to 0).
- Target diff stores mode+value together; markup 65 -> 0.65, 1001% refused; profit 1500 accepted.
- Sparse `pricing_defaults` row keeps valid keys.
- Reset deletes row and audit log records DELETE; seed a `product_pricing` row in `scripts/seed-dev.ts` if added to
  `FINANCIAL_TABLES` in `rls.test.ts`.
- Component test: 1,632/piece x 50 pcs -> medium total cost 3,885, price 5,500.
- PercentField: max>100, 2 decimals, empty -> null.
