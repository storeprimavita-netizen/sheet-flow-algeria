# MNW COD ERP — Final Specification (v2)

Finalized 2026-07-26 after the codebase audit (docs/AUDIT.md). This is the
source of truth for all v2 phases. Money is DZD unless stated; USD/EUR entries
store original amount + the FX rate used + converted DZD.

## 1. Product vision

ERP dashboard for Cash-On-Delivery ecommerce in Algeria. One store today,
**SaaS-ready**: every business table carries `workspace_id`, RLS scopes by
workspace, nothing assumes a single store. Stack is fixed: existing Next.js 16
app + Supabase free tier (Postgres/Auth/RLS) + Vercel.

### Navigation (exactly six sections)

1. **Dashboard** — BI home (absorbs old `/app/bi`, `/app/dashboard`, `/app/reports` export)
2. **Orders** — subviews: All / Confirmation / Delivery / Cash (admin-only cash reconciliation)
3. **Products** — list + product page tabs: Details / Pricing / Expenses / Stock / Statistics
4. **Contacts** — Customers + Suppliers
5. **Team & Rules** — users & permissions, rules docs, meetings, agent performance, audit log
6. **Settings** — workspace, integrations, wilaya fees, fixed fees, FX rates, thresholds

## 2. Roles & security

- **admin** — everything.
- **confirmation_agent** — Orders→Confirmation queue + customer info (history,
  risk score). Can set confirmation status + comment. NO costs, expenses,
  profits, dashboard finances, settings.
- **delivery_agent** — Orders→Delivery queue; delivery status only. Same
  financial blindness.

Enforcement layers (RLS is the wall, UI is cosmetic):
- `profiles` (user_id, workspace_id, role, is_active) + helper fns
  (`current_workspace_id()`, `current_app_role()`, `is_admin()`).
- RLS on **every** table: `workspace_id = current_workspace_id()` AND role rules.
- Financial secrecy is structural: money lives in admin-only tables
  (`product_costs`, `expenses`, `ad_spend_daily`, `fixed_fees`,
  `exchange_rates`, `cash_collections`, `product_scenarios`, `settings`).
- Column guard trigger on `orders` keeps agents inside their stage.
- `audit_log` records settings/expense changes; `order_status_history` records
  every status transition with actor + timestamp.

## 3. Orders

One `orders` table, filtered views.

- **Confirmation statuses**: `wait_for_confirmation, no_answer, closed_phone, cancelled, confirmed`.
- **Delivery statuses**: `wait_for_deposit, bureau_deposited, in_transit, out_for_delivery, stop_desk_waiting, delivered, cancelled, delayed, returning, returned`. Manual updates only; model stays clean for a future carrier API.
- Fields: source + external id, product/variant/qty, customer snapshot
  (name, phone, wilaya, commune, address) + `customer_id` link, sale price,
  delivery fee (+ `delivery_fee_source`: payload | wilaya_table | manual),
  `delivery_type` home|stopdesk, both statuses, confirmation comment +
  attempts, assigned agents, duplicate flags, timestamps for every transition
  (in `order_status_history`), created_by.
- **Webhooks** (Shopify `orders/create`, LightFunnels): Next.js route handlers
  (see §Deviations) — verify HMAC, store raw event in `webhook_events`, map to
  the unified shape, idempotent upsert on `(workspace_id, source, external_id)`,
  upsert customer by normalized phone, fill delivery fee (payload → wilaya
  table fallback; admin override later).
- **Duplicate detection**: same normalized phone + product within
  `settings.duplicate_window` (default 48 h) ⇒ `is_duplicate_suspect` +
  `duplicate_of` (DB trigger); flagged visually in the confirmation queue.
- **Delivered ⇒ revenue** for its product; **returned ⇒ return fee**
  (`settings.return_fee`) counts as product expense. Both are **computed** in
  views/queries, never stored duplicated. Stock: delivered −qty, returned +qty
  (trigger via `stock_movements`).
- Manual creation (admin), full audit trail.
- Phone normalization: `normalize_dz_phone()` handles 05/06/07, +213, 00213, spaces.

## 4. Products

Statuses `to_be_tested, tested, confirmed, cancelled`. Product **page** (not a
popup) with tabs:

- **Details** — name, images, fabric/tissu, category, variants, sale price,
  sourcing cost + currency (admin-only `product_costs`), notes.
- **Pricing** — BENZ engine (§6): Best/Medium/Worst editable + read-only
  **Real** column auto-filled from `product_stats` (actual confirmation %,
  delivery %, actual ad cost per delivered, actual fee allocations).
- **Expenses** — CRUD, category ∈ {shooting, packaging, sampling, confirmation,
  delivery, test_ads, scaling_ads, other}, amount + currency + stored rate +
  DZD value, date, note, optional supplier link. Plus **daily ad-spend quick
  entry** (product, date, amount, test/scaling) available here AND on Dashboard.
- **Stock** — current stock + movement history (folded-in Phase-11 feature).
- **Statistics** — received/confirmed/delivered/returned, rates, revenue,
  expenses by category, allocated share of monthly fixed fees, net profit,
  ad cost per delivered, profit per delivered.

## 5. Contacts

- **Customers** — auto-created from orders, deduped by normalized phone.
  Auto stats + **risk score** via `customer_stats` view. Formula (weights
  tunable in Settings → `risk_weights`):
  `risk = min(100, 100·(w_ret·returned + w_can·cancelled + w_na·no_answer) / (w_ret·total_orders))`.
  Shown to confirmation agents in the queue.
- **Suppliers/partners** — type ∈ {shooting_studio, atelier_couture, emballage,
  other}, name, phones, location, notes, linked expense history. Admin-only.

## 6. Pricing engine (BENZ — do not "improve" the math)

`src/lib/pricing.ts` already replicates the xlsx cell-for-cell and is verified:
BEST (sale 4900, cost 2500, rate 255, lead 2 €, conf 65 %, del 65 %, packaging
50, return fee 100, spend 20 €/day, fixed 3000+5000/mo) ⇒ net/delivered
≈ 1025.94 DZD, monthly ≈ 130,037 DZD. Keep formulas exactly; every division
guarded ("—", never NaN). v2 additions only:

- Scenarios persist per product in `product_scenarios` (jsonb inputs);
  `product_id = null` = general planner.
- Fixed fees & FX defaults seed from Settings (`fixed_fees`, `exchange_rates`)
  instead of hardcoded values.
- **Real** column: same `computeScenario()` fed by actuals from
  `product_stats` + `ad_spend_daily` (read-only).
- Unit tests pin the sheet's known values.

## 7. Dashboard (BI)

Global filter bar (date range, product, wilaya, source, confirmation agent,
delivery agent, status) applying to everything:

- KPI cards: total invested, revenue (delivered), net profit, confirmation
  rate, delivery rate, counts by stage.
- Funnel received → confirmed → shipped → delivered with drop-off %.
- Per-wilaya table + chart (delivery rate, counts) with stop-shipping flags
  (manual + auto from `wilaya_stats`).
- Rates per agent (`agent_performance`) and per product (`product_stats`).
- Spending breakdown by expense category.
- Ad-spend quick entry widget; next-meeting card (admins).
- Export toolbar (CSV) — folded-in Phase-12 feature.
- Everything computed from orders + expenses; no manual totals.

## 8. Team & Rules

- Users: admin invites by email (service-role API route), assigns role,
  deactivates. (No public self-signup activation.)
- Rules: markdown blocks CRUD (`rules_docs`). Simple.
- Meetings: schedule template in Settings (2/week); instances with objectives
  checklist (required before "held"), notes/decisions, attendees.
- Agent performance from `order_status_history` timestamps.
- Audit log viewer (admin).

## 9. Settings

Workspace info · Integrations (store domain + webhook secret per provider,
webhook URLs to copy, `last_event_at` health) · Wilaya fee table (58 rows,
home/stopdesk, manual stop-shipping flag) · Monthly fixed fees · FX rates
(manual, date-stamped) · Return fee, duplicate window, risk weights,
stop-shipping thresholds · Status label localization via i18n messages.

## 10. Quality bars

- CRUD everywhere the spec says CRUD; optimistic UI where cheap.
- DZD with thousands separators; foreign entries keep original + rate.
- EN/AR centralized strings (next-intl); FR can be added as a locale later.
- Zero financial data reachable by agent roles — **tested at RLS level**.
- Webhooks idempotent + raw events stored.
- TypeScript strict, zod on all inputs/webhooks, no `any`.
- Simple > clever; each phase ends with the app running.

## Deviations from the master prompt (justified)

1. **Webhooks stay as Next.js route handlers**, not Supabase Edge Functions.
   Already built and HMAC-verified; one deploy unit on Vercel; no Deno
   toolchain; Supabase free-tier function quota irrelevant. The unified order
   shape + `webhook_events` store keep a later move (or carrier integration) trivial.
2. **Cash reconciliation, stock, reports, order assignment** (built phases
   9–12) are kept but folded into the six sections (user-approved).
3. **Languages: EN/AR** (already built, RTL included) instead of FR/EN; strings
   centralized so FR is a file away (user-approved).
4. **`profiles` replaces `user_roles` + `team_roles`** (one row per user:
   role, workspace, duty, active) — fewer joins, same guarantees.
5. **Financial blindness via table split** (`products` vs `product_costs`)
   because RLS is row-level, not column-level.
6. **`meeting_objectives` is a table** (as spec'd) with a trigger enforcing
   "objectives before held".
7. Spec's `no_answer` replaces v1's `not_answer` enum value.

> **v3 (2026-11-17):** scope and navigation are extended by `docs/specs/` and decisions D15–D24. Where they disagree with this file, v3 wins (notably §1 navigation, §6 pricing, §9 integrations).
