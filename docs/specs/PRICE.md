# PRICE — pricing calculator v2 (automatic)

Replaces the BENZ scenario sheet as the pricing tool (D18). Source: the owner's
standalone calculator description + the request "I only set the product cost;
good / medium / worst settings are editable; the suggested price comes out with
the profit added (e.g. cost + 60–70%), rounded, with the 99 effect".

> **Formulas confirmed by the owner (2026-11-18).** The owner pasted the original
> build prompt of their calculator with the exact formulas and test numbers. The
> section "Formulas" below is that text; a script check reproduced every test
> number. The formulas are **fixed in code**; the numbers in "Settings" are the
> editable part (D38). Do not change the math.

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

## Formulas (owner's, exact — per scenario; c = confirmation, d = delivery as fractions)

```
B = parallel-market rate, O = official rate
sellable         = quantity × (1 − dead%)
cost_piece_dzd   = stock_cost_dzd / sellable            (stock cost is in DZD — no currency conversion)
k (platform real %) = platform% × B / O
orders_needed    = sellable / (c × d)
returned_orders  = sellable / d − sellable
ad_cost_per_delivered_usd = ad_cost / (c × d)
TOTAL AD SPEND (USD) = orders_needed × ad_cost ;  (DZD) = that × B

Cost per delivered piece (DZD) — 8 lines:
  product            = cost_piece_dzd
  ads                = ad_cost_per_delivered_usd × B
  returns            = return_cost × returned_orders / sellable
  confirmation       = confirmation fee
  packaging          = packaging
  other per order    = other fees per order
  other whole stock  = other_fees_total / sellable
  platform monthly   = monthly_fee_usd × months × share × B / sellable
TOTAL COST = sum of the 8 lines

exact price        = (TOTAL COST + target profit) / (1 − k)
platform % fee     = exact price × k
RECOMMENDED PRICE  = exact price rounded UP to the next 100        (default rounding rule)

At final price P (empty → the MEDIUM recommended price):
  profit per piece = P − TOTAL COST − P × k ;  net profit = profit per piece × sellable ;  margin = profit / P

Break-even (profit = 0), NP = P × (1 − k):
  min confirmation = (ad_cost × B / d) / (NP − (TOTAL COST − ads))                         "Not possible" if denominator ≤ 0 or result > 100%
  min delivery     = (ad_cost × B / c + return_cost) / (NP − (TOTAL COST − ads − returns) + return_cost)     same rule
  max ad cost (USD)= (NP − (TOTAL COST − ads)) × c × d / B                                 "Not possible" if ≤ 0
  min selling price= TOTAL COST / (1 − k)
```

Ad cost per received order: only MEDIUM is required; BEST = medium × 0.68 and
WORST = medium × 1.23, rounded to 2 decimals, unless typed.

### Pinned test (must pass exactly; unit tests in PRICE-1)

Default settings, product "benz", stock **81,600 DZD**, 50 pieces, ad cost
1.5 / 2.2 / 2.7 USD, final price 4,500:

| | BEST | MEDIUM | WORST |
|---|---|---|---|
| Total ad spend USD | 100.39 | 234.32 | 361.18 |
| Total ad spend DZD | 25,599 | 59,751 | 92,100 |
| TOTAL COST per piece | 3,063 | 3,885 | 4,641 |
| RECOMMENDED PRICE | 4,700 | 5,500 | 6,300 |
| Profit per piece at 4,500 | 1,350 | 528 | −228 |
| NET PROFIT | 60,769 | 23,745 | −10,274 |
| Min confirmation | 24.3% | 46.5% | 65.3% |
| Min delivery | 30.8% | 49.1% | 64.1% |
| Max ad cost USD | 5.06 | 3.07 | 2.40 |
| Min selling price | 3,123 | 3,962 | 4,733 |

### Screens to keep from the owner's tool

- **Settings** (once per workspace): the values in the table above, Save / Reset.
- **Product**: name, stock cost (DZD), quantity, ad cost best/medium/worst, final
  price; collapsed "advanced" = per-product override of any setting; results
  update live. One results table, columns BEST (green) / MEDIUM (orange) / WORST
  (red) through status tokens: confirmation %, delivery %, ad cost per order,
  orders needed, total ad spend USD and DZD, the 8 cost lines, TOTAL COST,
  + target profit, + platform % fee, RECOMMENDED PRICE (highlighted); then "At
  your final price" (profit per piece, net profit, margin); then break-even (red
  when the scenario is below it, green when above).
- **Multiple products**: scenario toggle, summary cards (total stock, combined ad
  spend, combined net profit + capital needed, blended margin), editable grid
  with live columns and a totals row, open one product's full table.
- Copy table and export (CSV now; Excel if asked).

Additions the owner asked for in the app: target as markup % as an alternative
to profit per piece, and other rounding rules (…900 / …990 / …99) as settings —
the default stays "round up to the next 100" so the pinned test holds.

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
