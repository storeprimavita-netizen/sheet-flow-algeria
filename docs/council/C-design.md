# Council C - Design audit (read-only)

Method: read CLAUDE.md UI rules, cod-ui-polish SKILL, DESIGN_SYSTEM.md; inspected docs/design/audit/final-13/*.png and 02-orders-all.png; read dashboard/page.tsx, kpi-tile, time-chart, sparkline, data-table, orders-all-table. App NOT run (no Supabase on :54321, only unrelated docker containers; seed + dev server not started). All findings are from screenshots (older than HEAD; dashboard has since gained Today/KPI2/P&L sections) and source. Verify with Playwright before shipping.

## Charts installed
No chart lib. deps: d3-geo, d3-delaunay (map only), hand-rolled inline SVG (Sparkline, Funnel, TimeChart, PnlWaterfall, CategoryBars, StatusBreakdownBars, AlgeriaMap). Recommendation: keep it. Add NO recharts/echarts (50-300KB gz, client-only). All new charts = server-rendered SVG/CSS-width bars (zero JS); only interactivity (hover tooltip) via `<title>` or a tiny client wrapper. If an axis helper is needed, `d3-scale`/`d3-shape` (a few KB, tree-shaken) is the only acceptable add; not required.

## Dashboard wireframe (desktop 12-col, mobile = stack in same order)

```
[PageHeader: Dashboard]                     [New order]
[Filter bar: presets Today|7d|30d | From To | Product Wilaya Source Agent  (collapsed "More filters")]
-- HERO ROW (lg:grid-cols-4, KpiTile hero, each drills to filtered orders) --
| Confirmation rate | Delivery success  | CPDO (cost/delivered)| ROI / ROAS         |
| 63.3%  (hero)     | 52.6%             | 1,840 DA             | -54%  (tone=danger)|
| d +2.1pt  spark   | d -1.4pt  spark   | d -3% (good=down)    | break-even 48%     |
-- SECOND ROW (lg:grid-cols-4, normal tiles) --
| Net profit        | Revenue           | Stock: 3 low / 41 ok | Cash to collect    |
| -177,720 DA       | 151,500 DA        | [Robe Zahra 2 left]  | 84,000 DA / 12 ord |
-- ATTENTION STRIP (alerts: low stock, stuck, below break-even) one line each, links --
-- MAIN (lg:12) ------------------------------------------------------
| Profit vs spend over time (col-span-8)          | Funnel (col-span-4)        |
| line: net profit (chart-1) + spend (chart-3),   | Received 60                |
| zero line, 3-5 y ticks, first/mid/last dates,   | Confirmed 38  63% (-37%)   |
| series toggle chips                              | Shipped 30   79%           |
|                                                  | Delivered 20 67%           |
|                                                  | step-conv % between rows   |
-- OPS (lg:12) -------------------------------------------------------
| To confirm 18 -> | To ship 26 -> | Stuck >5d 4 -> | Cash to collect | Today vs yesterday |
| Confirmation breakdown bars (col-6)  | Delivery breakdown bars (col-6) |
-- PRODUCT CPDO (col-span-7)                 | Wilaya table + map (col-span-5)
| horizontal bars sorted desc, one row per product:
| Robe Zahra     |#########--------| 2,400 DA   (bar fill = chart-1; red text-danger if > break-even CPDO)
| Veste Sarah    |####-------------| 1,100 DA   dashed vertical line = avg CPDO
| Ensemble Lina  |######-----------| 1,500 DA   click -> /app/products/[id]?tab=stats
-- By agent table / category spending / P&L waterfall (collapsible "Finance detail" below the fold) --
```
Rule: top-left = what decides the day. The current page leads with 5 "Today" ops tiles then a 12-col KPI grid (Net profit big, 8 more tiles = 14 tiles before any chart). Finance lens (P&L waterfall) sits above funnel/time chart. Reorder: hero 4 -> chart+funnel -> ops -> product CPDO -> detail. Cap tiles above fold at 8.

## Findings (screenshots + source)

Dashboard
1. Old screenshot: Revenue/Invested/Net profit are huge colored numbers (text-success/danger at 32px, wrap to 2 lines "151,500 / DZD"), while confirmation/delivery rates (the decision KPIs) are small white. Hierarchy inverted. Fix: hero prop on confirmation/delivery/CPDO/ROI; money tiles 24px, `whitespace-nowrap`. File: src/components/stats/kpi-tile.tsx, src/app/app/dashboard/page.tsx:394-480.
2. Tile label wraps ("Confirmation rate" on 2 lines) causing uneven tile heights; sparkline competes with label. Fix: sparkline below value on <xl, `min-h` fixed, label `truncate`. kpi-tile.tsx.
3. Sparklines render dramatic flat-then-spike shapes (no baseline, min-max scaled) - decorative, implies volatility; Sparkline returns null if <2 distinct values (ok). Fix: only show on >=7 data points; scale from 0 for rates.
4. TimeChart (time-chart.tsx): only 2 y labels ("42,900 DZD" 10px, near-invisible), first/last date only, both series red-ish (invested dashed red + net profit red) - series colors not distinguished, mirror-image looks like a bug. Use --chart-1 for net profit and --chart-3 for spend; add zero baseline label, 4 ticks, mid date, 12px text min. Dates show ISO 2026-07-01; use formatDate.
5. Funnel shows "-36.7%" drop in danger color on every step; shipped/delivered bars amber. Show step conversion (%) neutral, color only when below benchmark. src/components/stats/funnel.tsx.
6. Date inputs show native "mm/dd/yyyy" placeholder (screenshot) - locale-wrong for Algeria; filter bar uses native selects in old shot (white-ish chevrons). Confirm DateRange/Select components from fields/ are now used. dashboard-filter-bar.tsx.
7. page.tsx is 751 lines, 14+ queries in one RSC; no <Suspense> boundaries per section found (grep) - one slow RPC blocks whole page. Wrap chart/table sections in Suspense with skeleton cards; app/loading.tsx is generic 4-tile+table skeleton, not dashboard-shaped.
8. Error state: error.tsx is app-wide; a failed stats RPC kills the whole dashboard. Section-level error + retry per section.

Orders table (src/app/app/orders/all/orders-all-table.tsx, data-table.tsx)
9. Order ID: `num font-medium` default --text, contrast fine (bold on dark, ~15:1). Problem is not contrast but identity: IDs look identical to plain text, no link affordance; seed ids "SEED-DUP-2" truncated at max-w-[9rem]. Fix: `text-foreground font-semibold` + underline on hover is OK; consider text-primary only on hover/focus. Keep sticky.
10. Density: rows h-11 comfortable / h-9 compact; cells `px-3 py-2`. Fine, but default-visible cols = ~10 (order, date, customer+phone, product+thumb, qty, total, wilaya, source, confirm, delivery, [tags]) -> horizontal scroll at 1280. Hide qty, source, tags by default (defaultHidden already exists on delivery_fee, agent). Merge qty into product cell ("Robe Zahra x2").
11. RTL screenshot (final-orders-all-ar-rtl-dark.png): page content clipped at the start edge (sheet/filter bar spills off-screen left, header button cut), total "4,900 DZD" wraps to 2 lines, date "2026-07-28" wraps (w-28 too narrow in Arabic font; whitespace-nowrap exists but wraps in screenshot -> probably before the fix; verify). Fix: `whitespace-nowrap` + `min-w-[6rem]` on total column, check main container `min-w-0` and overflow-x in app-shell RTL.
12. Empty optional columns: Placed-at shows "—" for rows (seed); tags/agent columns empty for most. Hide column automatically when all rows on page empty (data-table: `c.hideWhenEmpty`).
13. Status pills: confirmed = solid green and returned = solid red-fill in 02-orders-all.png vs tinted bg + fg per spec (text-white on saturated fill is exactly what DESIGN_SYSTEM bans). Later screenshots (final-13) show tinted pills; confirm all tables use StatusPill and no legacy solid chips remain (grep `bg-success`/`bg-danger` without /15).
14. Filter bar: 8 filters in a card consuming ~150px before first row, with explicit Search/Cancel buttons. Move to a one-line toolbar: search + status chips + "Filters (n)" popover. Apply on change (URL-persisted already).
15. Responsiveness: no card-view fallback below md; table scrolls horizontally. On <md render rows as cards (order, customer, status pills, total). Confirmation queue mobile sheet exists (final-13) - reuse pattern.

Navigation
16. Sidebar (final-dashboard-desktop-dark.png): section labels ORDERS/FINANCE/CONTACTS/TEAM & RULES look like disabled uppercase items at icon-size, same visual weight as links; collapsed state shows group label with no children. Newer RTL shot shows nested children with count badges (18, 26) - good. Make group labels 11px `text-faint`, children indented with `border-s` rail. Count badges: fine.
17. Header search "Search ⌘K" is good; user menu popover in RTL overlaps sidebar and is clipped (rtl shot). Check popover `side`/`align` under dir=rtl.
18. Floating "N" (Next dev badge) overlaps sign-out/sidebar - dev only, ignore.

## Token / size recommendations (existing tokens only)
- KPI hero: `text-3xl font-semibold num` (32px token); normal tile `text-2xl`; label `text-xs text-muted-foreground`; tile padding p-4; height fixed ~96px (hero 112px). No new tokens.
- Tone: color the number only for signed money (profit/loss) per spec; rates stay --text with delta chip in success/danger.
- Chart colors: series via --chart-1..5 only; threshold/avg lines `stroke-border-strong` dashed; text 12px `fill-muted-foreground`; gridlines `stroke-border`. Do not use status colors for series.
- Radius 8 everywhere (cards currently `rounded-xl` in loading.tsx vs 8px spec - normalize to `rounded-lg`).
- Touch targets: icon buttons h-9 (36px) below 44px on mobile; add `min-h-11` for row actions/pills on `<md` only.
- Row heights keep 44/36. Table numeric cols: `num text-end`, `whitespace-nowrap`.
- Grid: `grid-cols-2 md:grid-cols-4` for hero (never 1 col on phones for hero tiles - 2x2 saves scroll).

## Performance-conscious chart strategy
- Server-render all SVG (TimeChart currently "use client" for useTranslations only; pass labels as props -> RSC, zero JS).
- Pre-aggregate in SQL (stats RPC already returns daily); cap at 90 points, bucket weekly beyond that.
- Product CPDO bars: pure CSS `width: calc(v/max*100%)` divs, no SVG.
- Hover detail via native `<title>` / table-based a11y fallback `<details>`; no tooltip lib.
- Stream sections with Suspense; fetch below-fold sections (agent, category, waterfall) lazily or in separate async components so hero KPIs paint first.
- Reduced motion: no chart animation.

## Top 8 fixes (priority)
1. Hero KPI row: confirmation, delivery, CPDO, ROI - src/app/app/dashboard/page.tsx:394, kpi-tile.tsx
2. Reorder page: charts+funnel above P&L/detail; Suspense per section - page.tsx
3. TimeChart axes/colors/RSC - src/components/dashboard/time-chart.tsx
4. Product CPDO bar chart (new CSS component under src/components/dashboard/) fed by byProduct data at page.tsx:686
5. Orders table default columns + hideWhenEmpty + qty merged - orders-all-table.tsx, data-table.tsx
6. RTL clipping/wrapping audit of orders + user popover - app-shell.tsx, data-table.tsx:250
7. Mobile card view for orders; 2-col hero tiles
8. Dashboard-shaped loading.tsx + per-section error boundary with retry - src/app/app/loading.tsx, error.tsx
