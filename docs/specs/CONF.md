# CONF — confirmation workspace

Goal: a confirmation agent opens one page and works all day there, in the
layout they prefer, with everything needed to decide on a call visible without
leaving the order. Permission matrix D10 is unchanged — agents still cannot
edit customer fields, see costs, or touch shipped orders; every status change
still goes through `transition_order_status`.

## Saved views

`order_views` (workspace_id, owner_id null = shared by admin, name, emoji,
scope `confirmation|shipping|all`, layout `table|kanban`, config jsonb:
filters, sort, visible columns, group-by, card fields; position). RLS: a user
reads shared views + their own, writes their own; admin writes shared ones.

- Views render as tabs above the list; the active view and any unsaved change
  to it live in the URL, so a link opens the same thing for a teammate.
- Seeded shared views: New (wait_for_confirmation) · No answer / closed phone
  · Callbacks due · Today confirmed · Duplicates · Kanban by status.
- **Table**: dense, sortable, column chooser, bulk assign (admin).
- **Kanban**: columns = confirmation statuses (or another group-by the view
  names: attempts, wilaya, product). Drag = the same transition RPC; an illegal
  move snaps back with the reason. Every card has a status select as the
  keyboard equivalent. Card fields are chosen per view (product, wilaya,
  total, attempts, age, score dot).
- Filters: status, product, wilaya, source, attempts, age, duplicate flag,
  score band, assigned to, date range, and season (STATS.md).

## Customer score hover card

Hovering (desktop) or tapping (phone) the customer name shows, from
`customer_stats` — no money beyond what D10 already shows agents:
total orders · delivered · returned · cancelled · no-answer · delivery rate ·
risk band with the reason in words ("2 of 3 orders returned") · last order
date and status · how many times they ordered **this** product · other open
orders for the same phone. "View all" opens Sell → Customers. One query per
hover, cached; never blocks the row.

## Calling flow

- **Attempts**: each no-answer / closed-phone transition records an attempt
  (time, agent, outcome) — derived from `order_status_history`, no new writes
  from the app. The sheet shows the attempt timeline.
- **Callback**: `orders.callback_at` (agent-writable via the RPC allow-list);
  a "Callbacks due" view sorts by it; a notification fires when due (NOTIF).
- **Auto-cancel** after N unanswered attempts over M days (settings
  `confirmation_rule`, default off) — a scheduled job, audited as system.
- **Blocklist / auto-hold**: `blocked_phones` (admin-managed); an order from a
  blocked or high-risk phone is flagged and can be auto-held per setting. Own
  history only — no shared cross-merchant list (D11 spirit: nothing invented).
- **Upsell on the call**: if the product has offers (STORE.md), the sheet
  shows them and "apply offer" changes quantity and price through an
  admin-defined offer only — the agent never types a price.
- WhatsApp / call links stay as today (`phone-links.tsx`), with message
  templates from Settings.

## Tasks

CONF-1 views table + tabs + table layout (lane db) · CONF-2 kanban layout ·
CONF-3 score hover card · CONF-4 attempts timeline + callback + views ·
CONF-5 auto-cancel job + blocklist (risk high) · CONF-6 apply offer on call
(after STORE-3).

## Acceptance

RLS tests: an agent cannot read another agent's private view or write a shared
one; kanban drag by an agent to a status the RPC refuses leaves the order
unchanged; hover card query returns no cost columns for an agent session.
