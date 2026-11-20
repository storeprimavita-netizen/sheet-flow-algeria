VERDICT: PASS

## Summary
Round 2 (qa-reviewer + ui-reviewer). No high or medium findings. Review-1 findings 1-8 and 10-13 are verified fixed. Still open: 9 (home/stop-desk counts have no drill link) and 14 (no breadcrumb), both now low.
Live DB check (rolled-back txn): a delivery-agent session gets 0 rows from kpi_by_wilaya and kpi_drill_orders and all zeros from kpi_group_extras (00060). The admin wilaya rows sum to kpi_rates received over the whole set (59). anon and PUBLIC cannot execute any of the 4 functions. The drill predicates match the kpi_rates filters.
Caveat: the UI reviewer took no new browser screenshots. Dark, EN, 1280px and the error state were not checked live; only the committed ar-light-390.png was inspected.

## Findings (all low)
1. LOW: `src/components/stats/commune-panel.tsx` (~378-382) and `supabase/migrations/00059_kpi_drill_orders.sql`. The home and stop-desk counts are not links, though the brief goal says every count links. `p_delivery_type` exists but nothing uses it. Fix: add a `shipped` drill metric (delivery-denominator rows) filtered by delivery_type and link both counts to it.
2. LOW: `src/components/stats/wilaya-table.tsx` (~775-779). The Unknown-wilaya row always looks hovered: its code is null and hovered starts as null, so `hovered === code` is true. Fix: `code !== null && hovered === code`.
3. LOW: `wilaya-table.tsx` (~789). In AR the open chevron points up, because the flip runs before the rotation (visible in ar-light-390.png). Fix: `open ? "rotate-90" : "rtl:-scale-x-100"`.
4. LOW: `statistics/page.tsx` (~420) and `orders/all/page.tsx` (~192). `ISO_DATE` accepts impossible dates such as `?from=2026-02-30`. The RPC throws "date/time field value out of range", so the statistics page shows error.tsx and the drill shows its load error. The code comment says invalid values are dropped. Fix: also validate with `z.iso.date()` or a Date round-trip.
5. LOW: wilaya-table.tsx, 390px. When the bars are hidden, the only "not enough data" cue for matured=false is a `title` tooltip, and touch devices never show it. Fix: add a visible muted marker or text.
6. LOW: `kpi_by_commune` computes `kpi_group_extras` for every commune, but the panel shows only the wilaya extras. Fix: render them per commune, or skip the call.
7. LOW: `orders/all/page.tsx` (~272). The drill banner shows the lowercased key ("centre"). Fix: pass the display spelling as a label-only param.
8. LOW: `orders/all/page.tsx` (~186). `MAX_COMMUNE_KEY = 120` but `orders.commune` has no length limit, so a key over 120 characters shows a count in the table and drills to 0 orders. Fix: skip the link when the key is longer than the limit.
9. LOW: `wilaya-table.tsx` (~785). `aria-controls` points to an element that does not exist while the panel is closed. Fix: set it only when the panel is open.
10. LOW: the brief's "Sell > Statistics" breadcrumb is missing; the app has no breadcrumb component.
11. LOW: the chevron hit area is about 40px at 390px (under 44). Also, in drill mode the fetch sorts by sortCol and then re-sorts by rank, so the first sort does nothing (harmless).
12. LOW (product question, not blocking): in AR, wilaya and commune names render in Latin script.

## Missing tests
- An agent opening `/app/statistics` is redirected (listed in the brief).
- `aria-expanded` toggles on the commune chevron (listed in the brief).
- AlgeriaMap render test with matured=false: the current test asserts on source text.
- avg_days excludes a swapped delivered original (only in_transit is covered).
- Drill `return` count includes a swap original (D47); commune-level confirmed and return drill totals.
- anon and delivery-agent calls to `kpi_drill_orders`.
- Drill count through the orders/all page itself (commune_unknown param, input validation, page total), not only at the RPC level.
- Drill banner renders, and leaving drill mode removes the params; a NULL-wilaya row renders with no link.
