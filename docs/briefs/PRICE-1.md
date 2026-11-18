# PRICE-1 `pricing-v2.ts` engine + pinned tests
risk: high · surface: none · lane: catalog
(money: pricing math lives ONLY in `src/lib/pricing*.ts`; pure functions, no DB, no UI)

## Goal
A pure, NaN-free engine implementing the owner's exact formulas (D50, spec PRICE.md "Formulas"),
with every setting passed in as a parameter (D38), pinned by the benz test.

## Definition of done
- `src/lib/pricing-v2.ts` exports `computePricing(settings, product, scenario)` and `computeAll` (best/medium/worst).
- `src/lib/pricing-v2.test.ts` reproduces every cell of the pinned table (rounded as the spec shows).
- Every division guarded: result field is `null` (never NaN/Infinity); break-evens return `null` = "Not possible".
- No import of `pricing.ts` (BENZ stays untouched until PRICE-4); no DB, no migration, no UI, no i18n.
- `scripts/gate.sh` passes.

## Files
1. `src/lib/pricing-v2.ts` (new)
   - `PricingSettings`: officialRate, parallelRate, platformPct, platformMonthlyUsd, months, share, packaging,
     confirmationFee, otherPerOrder, returnCost, otherStockFees, deadPct, confirmPct{best,medium,worst},
     deliveryPct{...}, adMultiplier{best,worst}, target {mode:"profit"|"markup", value}, rounding
     ("none"|"up100"|"nearest50"|"nearest100"|"charm900"|"charm990"|"charm99").
   - `DEFAULT_PRICING_SETTINGS` = spec table (platform 1% / 29 USD = LightFunnel preset; native preset 0/0 exported as `NATIVE_PLATFORM_PRESET`). Default rounding `up100`, target profit 1500.
   - `PricingProduct`: stockCostDzd, quantity, adCostUsd{medium, best?, worst?}, finalPrice?, overrides?: Partial<PricingSettings>.
   - `resolveAdCosts`: best/worst = round2(medium x multiplier) unless typed.
   - `computeScenario`: sellable, costPiece, k = platform% x B/O, ordersNeeded, returnedOrders, totalAdUsd/Dzd, the 8 cost lines, totalCost, exactPrice, platformFee, recommendedPrice, at final price (default = MEDIUM recommended): profitPerPiece, netProfit, margin, breakEven {minConfirmation, minDelivery, maxAdCostUsd, minSellingPrice}.
   - `applyRounding(exact, rule)`; markup mode: exact = (totalCost x (1+markup)) / (1-k) (target profit = totalCost x markup).
   - Round only at display/test time; internal values stay unrounded (pinned numbers match unrounded math: verified by script, e.g. medium totalCost 3885.39, rec 5500, profit 527.68).
2. `src/lib/pricing-v2.test.ts` (new): test names below.

## Steps (each commit+push via scripts/step.sh)
1. types + defaults + `applyRounding` + tests for rounding rules.
2. `computeScenario` cost lines/total/recommended + benz rows: ad spend, total cost, recommended price.
3. final-price block + break-evens + benz rows for profit, net profit, min conf/delivery, max ad, min price.
4. guards (null cases), overrides merge, markup mode, `resolveAdCosts`.

## Acceptance tests
- `benz pinned table: best / medium / worst` (all 10 rows each; USD to 2dp, DZD/% rounded as spec).
- `recommended price rounds up to next 100 by default`
- `charm rounding 900 / 990 / 99 endings`
- `markup mode derives target from total cost`
- `native preset (0% / 0 USD) removes platform lines`
- `zero quantity, 100% dead stock, c or d = 0 return null not NaN`
- `break-even returns null when denominator <= 0 or result > 100%`
- `typed best/worst ad cost overrides multiplier`
- `per-product override beats workspace setting`

## Edge cases / assumptions
- Formulas verified by script against the pinned table (all three scenarios match); spec P-1 closed, D50 locks them.
- "Min selling price" uses k; if k >= 1 -> null.
- Break-even formulas use ad cost of the same scenario and P = final price (or medium recommended).
- Charm rounding semantics (…900 = next number ending 900 at or above exact; …99 = next ending 99) are my reading; spec lists them only as options, default is unaffected. No new DECISIONS row needed.
- Storage (`settings.pricing_defaults`, `product_pricing`) is PRICE-2, not here.
