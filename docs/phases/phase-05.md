# Phase 5 — Orders core: queues, statuses, history, customers, duplicates

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §3 + §5 (risk display),
docs/DB.md (orders, order_status_history, customers, triggers).

## Goal

The heart of the app: the three order views + manual creation + customer
auto-upsert + duplicate flags + cash subview.

## Pages

- **/app/orders/all** (admin): every column, filters (status pair, product,
  wilaya, source, agent, date range), pagination, link to detail.
- **/app/orders/confirmation**: queue for confirmation agents
  (`confirmation_status <> 'confirmed'` — RLS already scopes agents; admin
  sees the same view unscoped). Row: order info + inline customer panel
  (history counts + risk badge from `customer_stats`) + duplicate warning
  banner (`is_duplicate_suspect`, link to `duplicate_of`). Actions: status
  buttons (no_answer/closed_phone/cancelled/confirmed), comment field,
  attempts counter (+1 per dial).
- **/app/orders/delivery**: queue for delivery agents (confirmed orders),
  status progression buttons for the 10 delivery statuses.
- **/app/orders/[id]**: full detail + status timeline from
  `order_status_history` + assignment card (assign agents, admin).
- **/app/orders/new** (admin): manual creation — product, variant, qty,
  customer fields, wilaya select, delivery type; sale price defaults from
  product; delivery fee auto-filled from `wilaya_fees`
  (`delivery_fee_source='wilaya_table'`), admin-editable
  (`'manual'`).
- **/app/orders/cash** (admin): fold v1 cash-manager onto `cash_collections`
  — record collected COD per delivered order, mark deposited.

## Customer upsert (server action, also used by webhooks in Phase 6)

`upsertCustomerFromOrder()` in `src/lib/customers.ts`: normalize phone
(same logic as SQL `normalize_dz_phone` — port it to TS + share tests),
find by (workspace, phone), create or update name/wilaya/commune, link
`customer_id` on the order. Manual creation flow calls it too.

## Status updates

Server actions (RLS-enforced session client, pattern from v1
`orders/actions.ts` minus Slack). The DB trigger writes history — do NOT
insert history rows from the app.

## Acceptance criteria

- Full lifecycle clickable: create → confirm (comment) → deposit → … →
  delivered; every transition appears in the timeline with actor + timestamp.
- Duplicate: two orders, same phone + product, <48 h ⇒ second one flagged
  with link; confirmation queue shows the banner.
- Returned order ⇒ stock +qty; delivered ⇒ −qty (check products.stock).
- Confirmation agent: sees queue, risk badge, can set status/comment; cannot
  see delivery queue, sale margins, or change delivery status (UI + a raw
  supabase update attempt fails on the trigger).
- Delivery agent: mirror-image checks.
- `npm run build` green.
