# PRICE — pricing calculator v2 (automatic)

Replaces the BENZ scenario sheet as the pricing tool (D18). Source: the owner's
standalone calculator description + the request "I only set the product cost;
good / medium / worst settings are editable; the suggested price comes out with
the profit added (e.g. cost + 60–70%), rounded, with the 99 effect".

> **OWNER INPUT P-1 — formulas.** The owner's document arrived twice with the
> math stripped (and `THEME+CALCULATOR/SKILLCALCULATOR.md` is a copy of the
> theme file). Everything under "Formulas" below is **reconstructed** from the
> prose and must be confirmed before PRICE-1 ships: either the calculator's
> source code, or the numbers its results table shows for the "benz" sample.

## Settings (workspace defaults; each product may override any of them)

| Setting | Default | | Setting | Default |
|---|---|---|---|---|
| Official USD rate `R_o` | 132 | | Packaging / delivered | 90 |
| Parallel-market USD rate `R_b` | 255 | | Confirmation fee / delivered | 150 |
| Platform fee % of price `p` | 1% (0 for the native store) | | Other / delivered | 10 |
| Platform monthly fee `M` (USD) | 29 (0 for native) | | Return cost / returned | 200 |
| Months to sell a stock `m` | 2 | | Other fees whole stock `W` | 10,000 |
| Product's share of store `s` | 50% | | Dead stock `k` | 10% |
| Confirmation % best/med/worst | 82 / 65 / 58 | | Delivery % best/med/worst | 82 / 65 / 58 |
| Ad-cost multipliers best/worst | 0.68 / 1.23 | | Target: profit per piece **or** markup % | 1,500 DZD |
| Rounding | none · nearest 50/100 · charm ending (…900 / …990 / …99) | | | |

## Inputs per product

Stock cost `S` (DZD, from `product_costs` / the latest purchase when it
exists), quantity `Q`, ad cost per received order in USD (medium `a`; best and
worst = `round2(a × multiplier)` unless typed), optional final price `F`.

## Formulas (reconstructed — see P-1)

With `c` = confirmation rate, `d` = delivery rate of the scenario:

```
sellable        U  = Q × (1 − k)
orders needed   N  = U / (c × d)
ad spend        USD = N × a          DZD = USD × R_b
fee rate        f  = p × R_b / R_o          (fee billed in USD on the official value, paid at the parallel rate)

cost lines per delivered piece (DZD)
  product          S / U
  ads              a × R_b / (c × d)
  returns          return_cost × (1 − d) / d
  confirmation     confirmation_fee
  packaging        packaging
  other per order  other_per_order
  other whole stock  W / U
  platform monthly   M × R_b × m × s / U
TOTAL COST  C = sum of the eight

recommended price   P = (C + target_profit) / (1 − f)        (target = profit per piece)
                    P = C × (1 + markup) / (1 − f)           (target = markup %)
                    then apply the rounding rule (always rounds up to the next allowed ending)

at final price F (default: MEDIUM recommended)
  profit / piece  = F × (1 − f) − C      net profit = profit × U      margin = profit / F

break-even (profit = 0, other inputs fixed)
  min selling price  = C / (1 − f)
  max ad cost (USD)  = (F(1 − f) − C_without_ads) × c × d / R_b     "not possible" if ≤ 0
  min confirmation % / min delivery % = solve the same equation for c or d; "not possible" if the result is ≤ 0 or > 100%
```

Sanity check with the benz sample (S 81,600 · Q 50 · a 2.2, medium): U 45,
N ≈ 106.5, ads ≈ 1,328, C ≈ 3,885, P ≈ 5,491 before rounding. If the owner's
tool shows different numbers, the reconstruction is wrong — fix it, don't ship.

## Automatic part (what the standalone tool could not do)

- Product cost, quantity and sale price are read from the product; the
  calculator opens pre-filled on Catalog → Product → Pricing and in Research.
- A fourth column **Real**: the same function fed with actual confirmation %,
  delivery % (KPI contract D4, matured cohorts only) and actual ad cost per
  received order from `ad_spend_daily` ÷ orders. Read-only.
- Saving a product's cost recomputes the suggested price; a badge shows when
  the current sale price is below the medium break-even.
- Portfolio view (Catalog → Pricing): one row per product for the chosen
  scenario, totals (stock, ad budget USD/DZD, net profit, capital needed,
  blended margin), CSV export via `src/lib/csv.ts` (xlsx later if asked).

## Code

`src/lib/pricing-v2.ts` — pure functions, every division guarded (returns
`null` → UI shows "—" or "Not possible", never NaN/Infinity). Unit tests pin
the owner-confirmed sample values. `src/lib/pricing.ts` (BENZ) stays until
v2 is confirmed, then its screens are retired in PRICE-4; no third engine.
Storage: `settings.pricing_defaults` (jsonb) + `product_pricing` (product_id,
overrides jsonb, ad costs, final price) — admin-only, audited.

## Tasks

PRICE-1 engine + tests (blocked on P-1 for final numbers) · PRICE-2 settings +
product Pricing tab · PRICE-3 Real column + break-even badge · PRICE-4
portfolio view + retire BENZ screens.
