# Phase 8 — Contacts: customers + suppliers

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §5, docs/DB.md
(customers, contacts, customer_stats).

## Goal

The Contacts section: customer directory with risk/stats, supplier CRUD with
linked expense history.

## Pages

- **/app/contacts** → tabs Customers | Suppliers.
- **Customers** (list): name, phone, wilaya, orders/delivered/returned
  counts, risk badge (from `customer_stats`), search by phone/name
  (search normalizes the query phone first). Detail page: editable fields
  (name, wilaya, commune, notes), full order history with statuses,
  risk-score breakdown showing the formula inputs (returned/cancelled/
  no-answer counts × weights) so the score is explainable.
- **Suppliers** (admin-only): CRUD on `contacts` (type, name, phones[],
  location, notes). Detail: linked `expenses` history (by contact_id) with
  totals. Wire the supplier selector into the product Expenses tab
  (replace the plain input left in Phase 3).

## Notes

- Customers are created by orders (Phase 5/6) — no "new customer" button;
  merging duplicates is out of scope (phone normalization prevents most).
- Risk badge component is shared with the confirmation queue (extract to
  `src/components/risk-badge.tsx` if Phase 5 didn't).
- Confirmation agents may open customer detail (read-only, no expense data —
  supplier tab hidden + RLS-blocked).

## Acceptance criteria

- Search "+213 5 55..." finds the customer stored as "0555...".
- Risk score matches the documented formula for a hand-checked customer;
  changing `risk_weights` in Settings changes the score.
- Supplier expense history totals match the expenses table.
- Agent role: customers visible, suppliers invisible (UI + RLS).
- `npm run build` green.
