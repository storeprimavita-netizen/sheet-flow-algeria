# Dashboard research — COD Pilot, Ecomanager, CODBrain, MDM Express (2026-11-18)

Owner: "the dashboard is a bit bad and far … I don't like what it shows; I admire
60% of the MDM Express dashboard; cost per delivered order must be in USD, DZD
small and grey." Sources are the vendors' public pages (marketing, sample data).

| Product | Accessed | What its dashboard emphasises |
|---|---|---|
| CODBrain — https://codbrain.net/ | yes (sample screens) | P&L waterfall: Net revenue → COGS → Gross profit → Delivery + returns → Contribution margin → Allocated ads + opex → **True profit**; **Outstanding** cash + 30-day cash forecast; ad spend and ROAS per channel (Meta/TikTok/Google); carrier scorecard; brand scorecard; customer segments (VIP/returning/churning/at risk); confirmation "Pending / Confirm % / Avg time"; default currency setting, "FX-aware analytics". |
| MDM Express — https://mdm.express/how-it-works | yes (mock-ups only) | **Order journey** stages with done/live state (confirmed → in warehouse → out for delivery → payout, "step 5 of 6"); warehouse card (units in stock, shipped today, avg dispatch time); weekly payout card (orders delivered, AOV, platform fee, net payout); amounts in $. Few numbers, very visual. |
| COD Pilot — https://codpilot.net/en | **no** (HTTP 403 to automated access) | Only from search snippets: automatic order distribution to agents, duplicate/spam detection, stock movements + low-stock alerts, many carriers. Layout unknown. |
| Ecomanager — https://ecomanager.dz/en | **no** (HTTP 403) | Only from snippets: confirmation, preparation, delivery + payment tracking, after-sales, stock, accounting, statistics. Layout unknown. |

To see the "60% of MDM Express" the owner likes, and COD Pilot / Ecomanager
layouts, screenshots from the owner's own accounts are needed.

## Gaps in our current dashboard (as of v3 4b06b62)
- Too much on one page: 7-filter bar, KPI grid, P&L, chart, alerts, funnel, tasks,
  meeting, two status breakdowns, wilaya table + map, agent table, product table,
  spending by category, export — no clear first question.
- All money in DZD; ad money is paid in USD (owner rule D45).
- No cash position (money still with ZR vs received) — D39 makes this first-class.
- No stock view on the dashboard although stock is now staged (D34).
- Funnel stops at delivered; no "collected by ZR → paid out".

## Proposal — Dashboard v2 (spec in docs/specs/STATS.md §Dashboard v2)
See the spec; it is the source of truth for P1-2.
