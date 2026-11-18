# PRICE-1 `pricing-v2.ts` engine + pinned tests (rev 1, after review-0 FIX + D51)
risk: high · surface: none · lane: catalog
(money: pricing math lives ONLY in `src/lib/pricing*.ts`; pure functions, no DB, no UI)

## Goal
A pure, NaN-free engine implementing the owner's exact formulas (D50, spec PRICE.md "Formulas", D51 markup base),
every setting passed as a parameter (D38), pinned by the benz test.

## Definition of done
- `src/lib/pricing-v2.ts` exports `computeScenario(settings, product, {confirm, delivery, adCostUsd}, finalPrice?)`,
  `computeAll(settings, product)` (best/medium/worst; computes medium first, passes its recommended price as default P to all three), `resolveAdCosts`, `applyRounding`, defaults.
- `src/lib/pricing-v2.test.ts` reproduces every cell of the pinned table plus the extra pins below.
- Every division goes through one `div()` helper: non-finite or zero denominator -> `null`; all inputs checked finite; nulls propagate (total cost null -> all downstream null). Never NaN/Infinity.
- No import of `pricing.ts` (BENZ untouched until PRICE-4); no DB, migration, UI, i18n. `scripts/gate.sh` passes.

## Units (declare on the type)
All percentages are FRACTIONS 0-1 (platformPct, share, deadPct, confirmPct, deliveryPct, markup 0.65 = 65%). Money DZD except `*Usd`.
`deadPct` is the spec's "k for dead stock"; the platform-real-% factor is `k` in code comments: keep names distinct.

## Files
1. `src/lib/pricing-v2.ts` (new)
   - `PricingSettings`: officialRate, parallelRate, platformPct, platformMonthlyUsd, months, share, packaging, confirmationFee, otherPerOrder, returnCost, otherStockFees, deadPct, confirmPct{best,medium,worst}, deliveryPct{...}, adMultiplier{best,worst}, target{mode:"profit"|"markup", value}, rounding ("none"|"up100"|"nearest50"|"nearest100"|"charm900"|"charm990"|"charm99").
   - `DEFAULT_PRICING_SETTINGS` = spec table (LightFunnel preset 1% / 29 USD); `NATIVE_PLATFORM_PRESET` 0/0. Default rounding `up100`, target profit 1500.
   - `PricingProduct`: stockCostDzd, quantity, adCostUsd{best?, medium, worst?}, finalPrice?, overrides?: `DeepPartial<PricingSettings>`.
   - `mergeSettings(base, overrides)`: deep merge copying only defined, finite values per nested key; null/undefined ignored (jsonb null from PRICE-2 is safe).
   - `resolveAdCosts(medium)`: best/worst = round2(medium x multiplier) unless typed.
   - `computeScenario`: sellable, costPiece, k, ordersNeeded, returnedOrders, totalAdUsd/Dzd, 8 cost lines, totalCost, exactPrice = (totalCost + targetProfit)/(1-k), recommendedPrice, then at P (finalPrice if > 0, else medium recommended; finalPrice 0 and empty are distinct tests): profitPerPiece, netProfit, margin, breakEven{minConfirmation, minDelivery, maxAdCostUsd, minSellingPrice}.
   - Target profit: profit mode = value; markup mode (D51) = costPiece x markup (same in all scenarios).
   - `applyRounding`: round to cents before `ceil` (avoid 300.00000000000006 -> 400). Charm: next number ending 900/990/99 at or above exact (our reading, non-default). nearest50/100 may round below exact: documented in a comment and tested.
   - Internal values unrounded; round only in tests/display.
2. `src/lib/pricing-v2.test.ts` (new). Tolerance: `Math.round` for DZD, round2 for USD, 1dp for %; no default `toBeCloseTo`. Benz fixture passes `adCostUsd {best:1.5, medium:2.2, worst:2.7}` explicitly (resolveAdCosts(2.2) gives worst 2.71 and breaks the pin).

## Steps (each commit+push via scripts/step.sh)
1. types, units, defaults, `div()`, `mergeSettings`, `applyRounding` + tests (rounding, merge).
2. `computeScenario` cost lines/total/recommended + benz rows (ad spend, total cost, recommended).
3. final-price block + break-evens + benz rows (profit, net profit, min conf/delivery, max ad, min price) + `computeAll`.
4. guards, markup mode (D51), `resolveAdCosts`, remaining tests.

## Acceptance tests
- `benz pinned table: best / medium / worst` (30 cells; k 0.019318, medium total cost 3885.39, rec 5500, profit 527.68)
- `medium cost lines pinned individually` (product 1813.33, ads 1327.81, returns 107.69, other stock 222.22, platform monthly 164.33, per-order 150/90/10)
- `unrounded k and exact price` (0.0193182, 5491.48)
- `default final price uses medium recommended` (profit/piece 2331.10 / 1508.36 / 752.36; net 104899.5 / 67876.1 / 33856.3)
- `final price 0 vs empty`
- `recommended price rounds up to next 100 by default` (+ float-noise case)
- `charm rounding 900 / 990 / 99 endings`; `nearest rounding can undercut target`
- `markup mode derives target from product cost` (benz 65%: target 1178.67, exact 5163.81, rec 5200; best 4400 / worst 6000)
- `native preset (0% / 0 USD) removes platform lines`
- `null not NaN`: quantity 0, 100% dead stock, O=0, B=0, officialRate 0, parallelRate 0, k>=1, P=0, c or d = 0, NaN input
- `break-even null when denominator <= 0 or result > 100%` (incl. min delivery > 100%)
- `typed best/worst ad cost overrides multiplier`; `resolveAdCosts(2.2) -> 1.50 / 2.71`
- `per-product override beats workspace setting`; `nested partial override leaves other scenarios unchanged`; `null override value ignored`

## Edge cases / assumptions
- Formulas verified against the pinned table by script and qa-reviewer; spec P-1 closed, D50 locks them.
- Markup base resolved by D51 (product cost); the old "total cost" reading is gone. No new DECISIONS row needed.
- Storage (`settings.pricing_defaults`, `product_pricing`) is PRICE-2.
- Real column (PRICE-3) reuses `computeScenario` with actual c, d, ad cost.
