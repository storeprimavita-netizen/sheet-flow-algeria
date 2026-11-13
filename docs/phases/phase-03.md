# Phase 3 — Products section (details, expenses, ad spend, stock)

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §4, docs/DB.md
(products, product_costs, expenses, ad_spend_daily, stock_movements).

## Goal

Full Products section minus the Pricing tab (Phase 4) and the Statistics tab
(needs order volume — ships here reading `product_stats`, may show zeros).

## Pages

- **/app/products** — list: image, name, status badge, sale price, stock,
  cost total (admin), quick status change. Filters: status, category.
- **/app/products/new** + **/app/products/[id]** with tabs:
  - **Details** — name, sku, category, fabric, variants (simple jsonb list
    editor), images (URL list for now — no storage upload this phase),
    sale price, notes, status; sourcing cost + currency + rate →
    `product_costs` (separate card, admin-only data).
  - **Expenses** — table + CRUD for this product's `expenses`: category,
    amount + currency (rate auto-filled from `current_fx_rate`, editable),
    date, note, optional supplier (contact_id — selector can be a plain
    text/uuid input until Phase 8 builds suppliers UI).
  - **Stock** — current stock, movement history, manual movement form
    (purchase/correction) writing `stock_movements` (reuse parked
    `stock-manager.tsx` logic).
  - **Statistics** — render `product_stats` row: counts, rates, revenue,
    expenses by category, net profit = revenue − sourcing·delivered −
    expenses − ad spend − allocated fixed fees (allocation: fixed fees for
    the period × product's share of delivered orders; document the formula
    in code).
- **Ad-spend quick entry** widget component (`src/components/ad-spend-entry.tsx`):
  product select, date (default today), amount, currency (default EUR, rate
  auto), test/scaling. Upsert on the unique key. Used on the product page;
  Dashboard reuses it in Phase 7.

## Acceptance criteria

- CRUD works for products, costs, expenses, ad spend, stock movements.
- Multi-currency entries store original + rate + DZD; DZD shown with
  thousands separators everywhere (`src/lib/format.ts`).
- Stock updates when a movement is added (trigger-driven, verify).
- Agent role: products list readable (no cost/stock/expense data rendered —
  and RLS returns nothing for the financial tables anyway).
- `npm run build` green.
