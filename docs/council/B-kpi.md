# Council B — KPI metric contract audit (read-only)

Sources: 00022_pnl.sql (pnl_lines, dashboard_stats), 00006_analytics.sql (product_stats, wilaya_stats), 00018 (stock), src/lib/pricing.ts pnlMetrics (266-290), dashboard/page.tsx, pricing-real.ts.

## Current definitions (what code does today)
| KPI | Today | Evidence |
|---|---|---|
| Confirmation rate | confirmation_status='confirmed' NOW / ALL orders in window by placed_at. Includes duplicates, junk, still-waiting orders. | 00022:168,363; pricing.ts:284; 00006 product_stats |
| Delivery rate | delivered / confirmed (NOT resolved). In-transit/delayed/returning sit in denominator, so rate is depressed for young cohorts. Cancelled-after-confirm also in denominator. | 00022:364; pricing.ts:285; wilaya 00022:243-250 |
| Return rate | returned/(delivered+returned) - the only "resolved" ratio, and it's labelled separately | pricing.ts:286 |
| "CPA delivered" (CPDO) | ALL ad_spend (test+scaling) in window by spent_on / delivered orders in window by placed_at. Not shown on dashboard (computed, unused: grep cpa_ only in pricing.ts) | pricing.ts:282; 00022:60-65 |
| Cost per delivered | (revenue - net_profit)/delivered = COGS+return fees+ads+expenses+fixed, i.e. ALL costs incl. COGS | pricing.ts:283; dashboard page.tsx ~433 |
| ROI | does not exist. Only ROAS = revenue/ad_spend | pricing.ts:280; en.json:804 |
| Remaining sellable stock | products.stock = sum of stock_movements; confirmed order decrements immediately (reservation modelled as consumption); no "reserved" or "available" concept; `stock` shown as "on hand" and compared to threshold | 00018:11-14; stock/page.tsx:38,63; dashboard page.tsx:216 |

## Divergences / duplicated formulas / misleading
1. Rate formulas forked 5x: pnlMetrics (pricing.ts:284-285), dashboard_stats kpis (00022:363-364), per_product (00022:284-289), per_wilaya (00022:243-250), product_stats view (00006) and wilaya_stats view, customer_stats. CLAUDE.md says pricing math lives only in pricing.ts; rates are not. Any contract change must touch all.
2. Cohort mismatch: orders by placed_at, ad spend/expenses by spent_on (00022 header lines 7-8). Delivered status is read as of NOW, so recent cohorts look bad (delivery rate and net profit understated until shipments resolve). No maturity marker.
3. Filtered views lie about money: with wilaya/source/agent/status filters orders are filtered but ad spend and expenses are not (00022:60-70; only product filter applies). CPDO and cost-per-delivered inflate; fixed fees are share-allocated, ads are not (inconsistent). Filtering by confirmation_status makes confirmation_rate trivially 100/0.
4. Duplicates/junk: is_duplicate_suspect (00004:83) and duplicate_of never excluded from any denominator -> confirmation rate understated, "received" inflated. Also not eligible: test orders. Cancelled-before-contact fraud etc. have no flag.
5. "Confirmed" is terminal status that stays after later delivery cancel/return, so delivered/confirmed mixes: confirmed-then-cancelled stay in denominator; fine for delivery rate only if resolved-denominator used.
6. exchange/swap delivery_status (00016) are not in any rate: swap order B carries on; an "exchange" is neither delivered nor returned in pnl_lines (counted only if listed). Resolved set must define them. Return fee charged only on returned; cancelled-in-transit (courier refusal) costs nothing in P&L.
7. ROAS labelled in UI as ROI-like; user wants ROI = net_profit/total_cost. total_costs exists (pricing.ts:277 comment) -> ROI is one line, but missing.
8. Confirmation-agent commission, packaging and delivery surcharge exist in pricing.ts (scenario) but have no actuals source (pricing-real.ts:23-24), so actual "all-in cost" omits them; scenario "Real" column vs P&L therefore disagree. Courier fee on delivered is treated as pass-through (00022:10), so all-in cost excludes it - fine only if stated.
9. pricing-real.ts:37,36: lead cost = 30d ad spend (spent_on) / orders30 (all orders incl. duplicates, by placed_at) - lead cost per ORDER not per lead; confirmation_pct/delivery_pct fed from product_stats.* (unbounded all-time, not 30d) -> window mismatch within one scenario.
10. Stock: dashboard low-stock alert uses stock<=threshold (page.tsx:216) where stock already excludes confirmed-unshipped units, but also doesn't deduct the pending confirmation queue (no reservation of wait_for_confirmation). Negative stock allowed (stock page clamps with Math.max, hides oversell). Returned adds stock back immediately at status "returned" (00018:17-20) even before warehouse receipt; units in "returning"/in_transit are not visible as a separate bucket. No available vs reserved split.
11. Ad attribution: ad_spend_daily is per product/day/kind; no campaign->order link. "Attributable" = product-level spend. Orders have no source campaign column, so CPDO per product is the finest honest grain; with p_product null it is whole-business spend (including unlinked product_id null rows? only if column nullable - check) / all delivered.

## Proposed metric contract (single SQL source, TS only formats)
Common: window = cohort by orders.placed_at date in [from,to] (Africa/Algiers). Eligible order = not is_duplicate_suspect (or duplicate_of is null) AND not test/manual-junk; NEW column orders.excluded_reason text null (duplicate|test|fake) to let admin mark; eligible = excluded_reason is null. Every metric returns {value, num, den, matured:boolean}.

- Confirmation rate = count(eligible, confirmation_status='confirmed' ever, i.e. exists history to_status='confirmed' OR current confirmed) / count(eligible, unique by customer+product within window, not in wait_for_confirmation optionally). Primary: decided = eligible unique orders whose confirmation_status <> 'wait_for_confirmation'; also show raw "of received" as secondary. Same creation cohort. "Unique" = dedupe on (normalized phone, product) keeping earliest, which duplicate_of already encodes.
- Delivery success = delivered / (delivered + returned + cancelled_after_ship) over the confirmed cohort; resolved = delivery_status in (delivered, returned, cancelled with prior shipped). Exclude in_transit, out_for_delivery, delayed, returning, stop_desk_waiting, bureau_deposited, wait_for_deposit (exchange/swap: excluded from both). Show "in flight n" next to it. Cohort = confirmation cohort (placed_at).
- Ad CPDO = ad_spend_daily.amount_dzd for the same product set and spent_on window / delivered eligible orders in the same placed_at cohort. Valid only for product-level or unfiltered scope; when wilaya/agent/source filters are active return null ("not attributable") rather than whole spend. Optional lag shift: ad window = cohort window (documented) - mark matured=false if any cohort order unresolved.
- All-in cost per delivered = (COGS + return fees + ad_spend + expenses + prorated fixed fees [+ confirmation commission + packaging when actuals exist]) / delivered eligible. Courier fee remains pass-through (state it). Equals pnlMetrics.cost_per_delivered today minus eligibility.
- ROI = net_profit / total_costs, where total_costs = revenue - net_profit (= all-in cost * delivered). Percent. Null if total_costs=0. Keep ROAS as separate secondary labelled "ROAS" only.
- Remaining sellable stock = products.stock (on hand after confirm-decrement) - reserved, where reserved = sum(quantity) of orders with confirmation_status='wait_for_confirmation' and eligible (soft hold) ; floor display at 0 but expose raw negative. Define on_hand_physical = stock + qty of confirmed-not-yet-delivered (in warehouse/transit) if user wants physical; return it as separate column. Low-stock alert uses sellable.

Rules: ratios computed once in SQL (one function kpi_lines(...)) and returned as num/den; pricing.ts pnlMetrics keeps only break-even/margin and reads the SQL ratios. Replace the five copies. Hide/mark metric when den < 10 or cohort immature (<7 days old share > x).

## Minimum DB changes
1. orders.excluded_reason text null (or reuse is_duplicate_suspect + new is_test boolean). Index (workspace_id, placed_at) where excluded_reason is null.
2. SQL function public.kpi_lines(p_order_ids, p_from, p_to, p_product, p_filtered) extending pnl_lines (00022) with: eligible, unique, decided, confirmed, resolved_delivered, resolved_failed, in_flight, reserved_units, plus filtered_flag so ad-based KPIs null when p_filtered and not product-only. Reuse pnl_lines; do not add a parallel function.
3. View product_stock_v: stock, reserved (wait_for_confirmation eligible qty), sellable = stock - reserved. Feed dashboard low-stock (page.tsx:216) and stock hub (stock/page.tsx:38).
4. Reroute dashboard_stats.kpis/per_product/per_wilaya + product_stats/wilaya_stats to the shared resolved/eligible expressions (shared SQL helper function or one CTE) so rates agree. Types regen after.
5. Optional: persist confirmed_at/first_confirmed_at on orders (order_status_history already has it; needed so "ever confirmed" survives later status changes).
No new tables required.
