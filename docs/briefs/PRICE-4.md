# PRICE-4 brief — Portfolio view + CSV; retire BENZ screens
risk: low · surface: ui · lane: catalog   (no migration, read-only on v2 data; admin pages; money display)

Goal: Catalog -> Pricing becomes one row per product (chosen scenario) with totals and CSV export, built only on `pricing-v2`, and the BENZ planner/engine screens are removed.

## Definition of done
- `/app/pricing` (admin guard) lists every product: name, stock qty, stock cost, ad cost/order USD, recommended price, sale price, profit/piece at final price, net profit, margin, total ad spend USD + DZD, break-even min price, below-break-even badge (reuse `saleBelowBreakEven`).
- Scenario toggle best/medium/worst (default medium); all three computed server-side by `computeAll`, toggle is client-only; totals row + 4 summary cards: total stock cost, combined ad spend (USD and DZD), combined net profit, capital needed (D68: stock + ads, hint "stock + ads"), blended margin.
- Row opens `/app/products/[id]/pricing`. Totals and all cards sum ONE row set per scenario: rows whose scenario computes (net profit non-null). Products with no cost, no stock or no ad cost keep their row with "—" and count in "N products not included" (D68).
- CSV export through `src/lib/csv.ts` (current scenario, same columns, raw numbers, UTF-8 BOM already in `downloadCSV`).
- Four states: skeleton, empty (action: add product), error + retry, populated. Dark+light, EN+AR/RTL, tokens only.
- BENZ gone: no import of v1 `computeScenario`/`PricingInputs`/`seedForProduct`/`normalizeInputs`/`DEFAULT_INPUTS`/`SCENARIO_SLUGS`; no `scenario-engine.tsx`, `pricing-data.ts`, planner page; old `pricing.*` and `navOld.planner` strings handled.

## Files
- NEW `src/lib/pricing-portfolio.ts` (pure): `portfolioRow(workspaceDefaults, product) -> {scenario results x3 | null}`, `portfolioTotals(rows, scenario)`, `portfolioCsvColumns`. Uses `computeAll`/`resolveSettings` only — no formula copy. Add `capitalNeeded(stockCostTotal, totalAdDzd)` (null if either null; no formula in the page). Totals sum only over computing rows (D68).
- NEW `src/app/(app)/app/pricing/{page,loading,error}.tsx` + `portfolio-view.tsx` (client: toggle, table, cards, export). Loader: products (id,name,sale_price,stock) + `product_costs.sourcing_cost_dzd` + `product_pricing` + `getSetting(pricing_defaults)` in one `Promise.all`; `stockCostTotal(perPiece, stock)` like the product tab (quantity = stock, same as the calculator default). Layout: `export { AdminGuardLayout as default }`; page also calls `requireAdmin`.
- `src/components/nav-model.tsx`: pricing href -> `/app/pricing`; `oldKey` keep "planner". `src/lib/nav-model.test.ts` line ~65 adjust.
- `products/planner/page.tsx` -> `redirect("/app/pricing")` (old bookmarks).
- DELETE `products/scenario-engine.tsx`, `products/pricing-data.ts`, `src/lib/pricing.test.ts` v1 cases (computeScenario, breakEvenDeliveryPct, normalizeInputs only).
- `src/lib/pricing.ts`: remove BENZ half; KEEP `PnlLines`, `PnlMetrics`, `pnlMetrics`, `asPnl` in place (D68: no pnl.ts, no move, importers unchanged); rewrite header comment (actual P&L metrics; calculator is pricing-v2.ts). `pnlMetrics` tests stay in `pricing.test.ts`.
- `src/messages/{en,ar}.json`: drop `pricing.*` (v1), add `pricingPortfolio.*` (title, subtitle, columns, cards, scenario, export, missingCost, empty, error). Parity gate.
- `docs/DB.md`: `product_scenarios` note "unused since PRICE-4"; table is NOT dropped (destructive, owner). `rls.test.ts` keeps its generic entry.

## Steps (each via scripts/step.sh)
1. `pricing-portfolio.ts` + tests. 2. Page + view + messages + nav + redirect. 3. Delete BENZ files/strings/v1 tests, trim pricing.ts, header comment. 4. Screenshots + PROGRESS.

## Tests (by name)
- `pricing-portfolio.test.ts`: benz capital needed 107,199 / 141,351 / 173,700 (best/medium/worst; 81,600 DZD, 50 pcs); capital card = stock card + ad-spend DZD card; benz row reproduces MEDIUM 3,885 cost / 5,500 price / 23,745 net at final 4,500; best/worst totals; two-product totals equal sums; row with missing cost/stock/ad cost shows "—", excluded from all sums, counted; zero total revenue -> margin null (no NaN); per-product override changes only that row; CSV columns/escaping of a product name with comma and Arabic.
- `nav-model.test.ts` updated; i18n parity; grep test in gate that nothing imports removed v1 symbols (tsc covers it).

## Screens to screenshot (dark+light, EN+AR)
Portfolio populated (each scenario), empty, one product missing cost, narrow width (scroll, sticky name column), CSV button.

## Edge cases / assumptions
- "Capital needed" = D68: stock cost total + scenario totalAdDzd; excludes per-order lines, fees, delivery. Quantity = pieces in stock; scenario = toggle. Q-23 answered by default.
- Blended margin = sum net profit / sum (final price x sellable) over included rows.
- Real column NOT in portfolio (D68).
- Final price rule per row = saved `final_price` else medium recommended (same as `computeAll`); sale price badge compares `products.sale_price`.
- Archived/inactive products: include all returned by RLS unless `products` has an archive flag (check at build; if so exclude).
- No DB change; `product_scenarios` kept (D68). No new DECISIONS row needed.
