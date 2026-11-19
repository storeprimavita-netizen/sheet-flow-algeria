# PRICE-3 brief — Real column + below-break-even badge
risk: low · surface: ui · lane: catalog   (no migration, no new table, read-only; money display only, admin page)

Goal: the product Pricing tab shows a read-only fourth column "Real" (actual confirmation %, delivery %, ad cost per received order) computed by `computeScenario`, plus a badge when the product's sale price is below the medium break-even.

## Definition of done
- `pricing-real.ts` returns v2 inputs: `{confirm, delivery, adCostUsd, ordersReceived, matured}` from `kpi_summary` (D4/D46, all-time, product filter). No rate is re-derived in TS.
- confirm = `confirmation.value`; delivery = `delivery.value` (D67; swapped originals count as returned parcels, D47/D48); both fractions.
- adCostUsd = `ad_spend_dzd / counts.received / settings.parallelRate` (same set as the rates; same B as the engine so the Ads line equals real DZD spend per delivered). Unknown rate/0 received -> null.
- Real column is the 4th header (neutral/info token, not best/green), same rows as the others; every null -> "—"; below `hasData` (received = 0) the whole column shows "—" + hint "No orders yet".
- Not matured (kpi `matured` false on confirmation or delivery): column shows a "Preliminary" chip with tooltip (few orders / still in flight); numbers still shown.
- Real uses the same merged settings (workspace + product overrides), the same stock cost and quantity, and final price rule as the other columns (P = typed final, else MEDIUM recommended — pass `defaultPrice = medium.recommendedPrice`).
- Badge: when `products.sale_price` is set and `< medium.breakEven.minSellingPrice`, show a danger Chip "Sale price below break-even (X)" by the final-price hint; nothing when sale price null or break-even null. Text + icon, not color alone.
- Agents never reach this (page is `requireAdmin`; kpi money keys admin-only). Gate green, EN/AR parity, tokens only, both themes.

## Files
- `src/lib/pricing-real.ts`: rewrite `realInputsForProduct(supabase, productId)` -> `RealScenario` (drop v1 `PricingInputs`, `fixed_fees`, `product_stats`, `fxRateFor`, 30-day window; it has no other caller — grep confirmed, v1 `pricing.ts` import goes). Pure helper `realScenarioInput(kpi, parallelRate): {input: ScenarioInput; hasData; matured}` exported and unit-tested.
- `src/app/(app)/app/products/[id]/pricing/page.tsx`: call it in the existing `Promise.all`, pass `real` to the calculator.
- `pricing-calculator.tsx`: `useMemo` real result = `computeScenario(settings, {stockCostDzd: total, quantity}, real.input, applied.finalPrice, results.medium.recommendedPrice)` using `mergeSettings(mergeSettings(DEFAULT_PRICING_SETTINGS, defaults), applied.overrides)` (export a small `resolveSettings` from pricing-v2 if merge is duplicated — no formula copy); badge near line 212.
- `pricing-results.tsx`: optional `real` prop -> extra column; colSpan 4 -> 5; `min-w` bump; header chip token `info`/muted with `Activity` Lucide icon; break-even rows use existing `breakEvenState` (red when Real is below).
- `src/messages/{en,ar}.json` `pricingV2`: `scenario.real`, `real.noData`, `real.preliminary`, `real.preliminaryHint`, `product.saleBelowBreakEven`.
- `docs/DB.md`: no change. PROGRESS note.

## Steps (each committed with scripts/step.sh)
1. `realScenarioInput` + rewritten loader + unit tests.
2. Calculator wiring + Real column in results (+ messages).
3. Badge + messages; screenshots; PROGRESS.

## Tests (by name)
- `pricing-real.test.ts`: maps kpi to fractions; null kpi -> hasData false; zero received -> adCostUsd null; ad cost uses parallelRate; not-matured flag from either metric; Real with the benz inputs and c=.65,d=.65,ad=2.2 reproduces MEDIUM column (3,885 cost).
- badge helper (pure, in pricing-form.ts): below / equal / null sale price / null break-even.
- Existing live `kpi_summary` RLS suite untouched (no DB path changed); run `scripts/gate.sh`.

## Screens to screenshot (dark+light, EN+AR/RTL)
Pricing tab with data (Real shown, preliminary chip), product with no orders (Real "—"), badge visible, narrow width (horizontal scroll, sticky first column).

## Edge cases / assumptions
- Spec says "actual ad cost per received order from ad_spend_daily ÷ orders": `kpi_summary.ad_spend_dzd` is that same table, same set; used instead of a second query. Converted at parallel rate B (engine's rate), NOT the D45 official-rate display value, else the Ads line would not match real DZD. Plan row says dep P1-1 done: confirmed.
- All-time window (matches old behaviour); a window picker is out of scope.
- Real never shown for an agent (page guard); ads of other products excluded by the product filter; kpi `cpa` fields not used.
- Stale: PRICE-2 brief note "Tab replaced, Real column dropped until PRICE-3" is this task.
- Badge on the product list is NOT included (needs per-product engine run: PRICE-4 portfolio).
- No new DECISIONS row needed.
