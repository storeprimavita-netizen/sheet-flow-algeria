# PRICE-2 brief (rev 1, after review-0 FIX) — pricing settings + per-product overrides + Pricing tab
risk: high · surface: ui · lane: catalog   (new table + RLS + audit + money)

Goal: the owner edits workspace pricing settings once, overrides any per product, and the product Pricing tab shows the live best/medium/worst table from `pricing-v2.ts` (D50/D51/D52).

## Definition of done
- Settings -> "Pricing" section (a NAV_SECTIONS entry, `?section=pricing`, not a tab) saves/resets `settings.pricing_defaults` (admin-only, audited; Reset behind a confirm dialog; "Using built-in defaults" note when never saved).
- Table `product_pricing`: overrides, ad costs USD, final price; admin-only RLS, audited, cross-workspace safe.
- Pricing tab pre-filled: stockCostDzd = `product_costs.sourcing_cost_dzd` (PER PIECE) x quantity (engine divides by sellable qty, pricing-v2.ts:298); recomputed when quantity edited. Quantity = `products.stock`, not persisted, helper text says so.
- Final price: `sale_price` only as placeholder; stored null unless typed (empty -> medium recommended).
- Override UX: override fields empty with "Default: X" placeholder; "Overridden" chip + per-field reset icon button (accessible name); override count on Advanced header; link to Settings pricing section.
- Markup: segmented control (Profit/piece DZD | Markup % of product cost); switching mode resets, never reinterprets; live profit/piece beside it, "—" if cost missing. `target` (mode+value) always saved as one unit (D52).
- Validation (percent in, fraction stored): share 0-100 incl.; confirm/delivery (0,100]; platform/dead [0,100); markup <=1000%; months/multipliers/fees/rates >=0 (rates >0); rounding from fixed list. Invalid -> inline error, last valid table kept, Save disabled.
- "—" (missing input, title+aria-label) vs "Not possible" (icon + text) via one `<PricingCell>` used by all break-even rows.
- Gate green; EN/AR parity; no hardcoded colors; both themes.

## Files
- `supabase/migrations/00039_product_pricing.sql`: `unique(id, workspace_id)` on products; `product_pricing(product_id pk, workspace_id not null, overrides jsonb not null default '{}' check (jsonb_typeof(overrides)='object'), ad_best_usd/ad_medium_usd/ad_worst_usd numeric(10,2) check >=0, final_price numeric(12,2) check >0, updated_at)`; composite FK `(product_id, workspace_id) -> products(id, workspace_id) on delete cascade`; RLS + select/insert/update(USING+WITH CHECK)/delete with `workspace_id = current_workspace_id()` + admin predicate (as 00003); `set_updated_at`; audit_row trigger (row_id null: no `id`, accepted); no anon grants.
- `database.types.ts` regen `--local` only; `docs/DB.md` row + `pricing_defaults` key; `scripts/seed-dev.ts` seed a row; add to `FINANCIAL_TABLES` in `rls.test.ts`.
- `src/components/fields/percent-field.tsx`: extend (no fork) with `max`, `decimals`, nullable onChange (empty -> null). Today it clamps 0-100, rounds 1 decimal, empty -> 0.
- `src/lib/format.ts`: `formatUsd(v,{decimals:2})`; label table DZD vs USD.
- `src/lib/settings.ts`: `pricing_defaults` read schema = deep-partial merged over DEFAULT_PRICING_SETTINGS (one bad key must not reset all); strict save schema; target discriminated on mode (profit up to 1500+, markup fraction <=10).
- `src/lib/pricing-form.ts` (pure, no formulas): percent<->fraction, strict zod, diff vs defaults with `target` as one unit. Do not reuse `num()` from settings/actions.ts:18 (""->0); empty = inherit.
- `settings/pricing-section.tsx` + `actions.ts` save/reset (session client, admin re-check, zod).
- `products/[id]/pricing/{page,actions,pricing-calculator,loading,error}.tsx`: keep existing h2 (no second h1); page re-checks admin; `saveProductPricing` validates UUID, product in workspace, admin. Results table uses `Chip` with success/warning/danger tokens + label + icon (not StatusPill); sticky label column, row groups, tabular end-aligned numbers in ltr isolates, h-scroll at 390px; text cue below break-even. States: skeleton, error+retry, empty with "Set stock cost" action (form kept), save pending/success/failure, unsaved cue.
- `src/messages/{en,ar}.json`: under `pricingV2` (best/medium/worst, Not possible, break-even rows). Leave BENZ and `/products/planner` until PRICE-4.
- Replacing tab drops the Real column (`realInputsForProduct`) until PRICE-3: note in PROGRESS.

## Steps
1. Migration + types + DB.md + seed + RLS tests. 2. PercentField + format + settings schema + pricing-form + unit tests. 3. Settings section + actions. 4. Read-only live tab. 5. Overrides/ads/final price/save. 6. i18n, states, screenshots (dark/light, EN/AR, 390px), PROGRESS.

## Acceptance tests
- RLS: agent select/insert/update/delete 0 rows; other-ws admin insert refused (composite FK); `saveProductPricing` rejects non-UUID/other-ws id/agent; settings save agent refused.
- `pricing_defaults`: sparse row keeps valid keys; profit 1500 ok; markup 11 (fraction) refused; share 101, platform 100, confirm 0/120 refused.
- pricing-form: percent in -> fraction stored; target mode+value stored together when only value changes; empty -> inherit not 0; markup 65 -> 0.65, 1001% refused.
- Reset deletes row, audit logs DELETE. PercentField: max>100, 2 decimals, empty -> null.
- Component: 1,632/piece x 50 pcs -> medium total cost 3,885, price 5,500; PricingCell "—" vs "Not possible".
Screens: Settings -> Pricing; Product -> Pricing (empty, populated, below-break-even, error, invalid input).

## Edge cases
- Cost 0/missing -> empty state; quantity 0 -> "—"; non-DZD sourcing uses generated `sourcing_cost_dzd`.
- Native preset (`NATIVE_PLATFORM_PRESET`) sets platform % and fee 0; workspace default stays 1%/29 (D50).
- Agents never load these pages; tab hidden. Check PRICE-2 follow-up row (D52) before building. No new DECISIONS row.
