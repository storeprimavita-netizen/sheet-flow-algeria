# Phase 7 — Dashboard BI

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §7, docs/DB.md (views +
"Financial-effects rule").

## Goal

The real Dashboard home: global filters, KPIs, funnel, breakdowns,
stop-shipping flags, export.

## Steps

1. **Migration `00008_dashboard.sql`**: RPC
   `dashboard_stats(p_from date, p_to date, p_product uuid[], p_wilaya int[],
   p_source order_source[], p_conf_agent uuid[], p_deliv_agent uuid[])`
   returning one jsonb: stage counts, funnel, revenue (delivered:
   Σ sale_price·qty), invested (expenses + ad spend + sourcing·delivered),
   net profit, per-category spending, rates. `security invoker` — agents
   calling it get order counts only (financial sub-selects come from
   admin-only tables ⇒ null). Regenerate types after.
2. **Filter bar** component: date range (presets: today/7d/30d/custom),
   multi-selects for product, wilaya, source, agents, status — URL
   searchParams-driven (server components re-query on navigation).
3. Sections (admin): KPI cards (invested, revenue, net profit, conf rate,
   delivery rate, counts by stage) · funnel with drop-off % · per-wilaya
   table + bar chart (from `wilaya_stats`, filtered) with 🚫 flags
   (manual/auto) · per-agent and per-product rate tables · spending-by-
   category breakdown · ad-spend quick entry widget (Phase 3 component) ·
   next-meeting card (reads `meetings`, placeholder link until Phase 9) ·
   CSV export toolbar (rework parked v1 `reports-exporter.tsx` + `csv.ts`
   against the filtered dataset).
4. Charts: no heavy chart lib — reuse/extend the existing lightweight
   approach (v1 BI used simple bars); CSS/SVG bars are fine. Keep it fast.
5. Agent-facing dashboard: agents landing here get only their queue counts +
   personal stats — no money (verify what the RPC returns for them renders
   cleanly, not `null DZD`).

## Acceptance criteria

- Every filter combination changes every section consistently (spot-check
  wilaya + date).
- Numbers reconcile with SQL by hand for the seed dataset (document one
  reconciliation in PROGRESS.md).
- A wilaya breaching the stop-shipping rule shows flagged in dashboard AND
  its fee row shows the auto flag in Settings.
- CSV export downloads the filtered orders + a summary sheet.
- Agent sees zero financial figures. `npm run build` green.
