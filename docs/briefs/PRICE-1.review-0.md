VERDICT: FIX
## Summary
Brief review (design only). qa-reviewer recomputed the pinned benz table with node: all 30 cells match D50 (k=0.019318, medium total cost 3885.39, rec 5500, profit 527.68). The math is right.
Problems are in setup, guards and tests: shallow nested override merge yields NaN (high); fixture ad costs, percent units, incomplete division guards, scenario API shape (medium).
Markup base (total cost vs product cost) is a non-default reading: route to /decide, does not block the default.

## Findings (ranked)

1. **HIGH — shallow override merge produces NaN** (brief l.23 `overrides?: Partial<PricingSettings>`).
   `confirmPct`, `deliveryPct`, `adMultiplier`, `target` are nested. `{...settings, ...{confirmPct:{medium:0.7}}}` drops `confirmPct.best/worst` -> every best/worst cell NaN. A jsonb `null` from PRICE-2 storage does the same.
   Fix: `DeepPartial<PricingSettings>` + merge that copies only defined, finite values per nested key. Test: nested partial override leaves other scenarios unchanged; null override value ignored.

2. **MEDIUM — benz fixture must type all three ad costs** (brief l.24, l.37).
   `resolveAdCosts(2.2)` gives worst 2.71 (2.2 x 1.23 = 2.706) -> total ad 362.51 vs pinned 361.18, total cost 4648.97 vs 4641.39. Passing only medium makes the pinned test fail and invites a wrong "fix".
   Fix: brief states the fixture passes `adCostUsd {best:1.5, medium:2.2, worst:2.7}` explicitly.

3. **MEDIUM — percent units unstated** (brief l.18-20).
   Spec uses fractions; settings table shows "1%", "50%"; BENZ `pricing.ts` stores whole percentages. A 100x error type-checks.
   Fix: declare fractions 0-1 for platformPct, share, deadPct, confirm/delivery pct, markup; document on the type.

4. **MEDIUM — division guards incomplete** (brief l.12, l.42).
   Unguarded: officialRate=0 (k), parallelRate=0 (max ad cost), k>=1 (exact/recommended price, not only min price), P=0 (margin), medium recommended null -> default P null, NaN inputs (`parseFloat("")`). Nulls must propagate (total cost null -> all downstream null).
   Fix: one `div()` helper returning null on non-finite; validate inputs finite; tests for O=0, B=0, k>=1, P=0, NaN input.

5. **MEDIUM — scenario API cannot serve PRICE-3 Real column** (brief l.10).
   If `scenario` is only `"best"|"medium"|"worst"`, Real (actual c, d, ad cost) needs a second code path; best/worst calls also need medium recommended for default P.
   Fix: `computeScenario(settings, product, {confirm, delivery, adCostUsd}, finalPrice?)`; `computeAll` computes medium first and passes its recommended price as default P.

6. **MEDIUM (owner reading) — markup base** (brief l.26; spec PRICE.md l.6, l.25; D18).
   Brief reads "cost + 60-70%" as total cost (65% -> profit 2525/piece); product cost per piece gives 1179. Spec does not define the base.
   Fix: builder records the reading in the brief and raises it via /decide (QUESTIONS). Default profit mode unaffected, so not blocking.

7. **LOW — float noise in up100**: `Math.ceil(300.00000000000006/100)*100` = 400. Round to cents (or subtract epsilon) before ceil.
8. **LOW — rounding semantics**: charm reading acceptable (non-default), log in PROGRESS. nearest50/100 can round below exact and undercut target profit: document + test.
9. **LOW — test tolerance**: compare `Math.round` (DZD), round2 (USD), 1dp (%); avoid default `toBeCloseTo`.
10. **LOW — name clash**: spec uses k for dead stock and platform real %; keep `deadPct` and say so in comments.

## Missing tests
- Medium cost lines pinned individually: product 1813.33, ads 1327.81, returns 107.69, other whole stock 222.22, platform monthly 164.33, per-order 150 / 90 / 10.
- Unrounded k = 0.0193182, exact price 5491.48.
- Default final price (no F, P=5500): profit/piece 2331.10 / 1508.36 / 752.36; net profit 104899.5 / 67876.1 / 33856.3 (best/medium/worst).
- finalPrice = 0 vs empty final price.
- `resolveAdCosts(2.2)` -> best 1.50, worst 2.71.
- Min delivery null when result > 100% (high c, low net profit).
- Nested partial override; null override value.
- O=0, B=0, k>=1, P=0, NaN input -> null.
