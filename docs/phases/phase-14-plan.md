# Phase 14+ — Feature backlog (one sub-phase per Sonnet session)

Origin: user review, 2026-07-31. Each block is scoped to a single execution
session. Standard protocol every time: branch `mnw-14a`…, invoke
`ponytail:ponytail` before code + `ponytail:ponytail-review` before merge,
`graphify query` to orient + `graphify update .` after, `npm run build`
(+ `npm test`) green, screenshot self-critique in **both themes** for any UI,
append a PROGRESS.md block, merge `--no-ff` into `mnw`. Add each to the
PROGRESS phase table.

**Order:** 14a → 14b → 14c → 14d → 14e → 14f → 14g, then **14h (Google OAuth)
last** — it's in its own file `docs/phases/phase-14h-google-oauth.md` and is
blocked on the user's Google Cloud setup.

### Locked decisions (2026-07-31 — do not re-ask)
- **Status column:** UI shows ONE "Status" column; DB keeps `confirmation_status`
  + `delivery_status` separately (needed for timing stats + RLS). *Display*-merge,
  not a schema merge.
- **Free status changes:** drop the rigid transition graph. Within their role,
  users set any status in their domain (fixes the misclicked-confirm problem).
- **Agent visibility:** both agent roles SEE all workspace orders; role only gates
  WHICH statuses they may set. Money stays UI-gated (`showMoney`) + financial
  tables stay admin-only — this RLS change exposes no new money.
- **Exchange:** happens AFTER `delivered` (customer wants to change size/etc.).
- **Swap:** client A's returned order → creates a NEW linked order for client B.
- **Return fee:** already exists (`return_fee` setting, used in finance/income);
  just set default to **150 DZD**.
- **Stock:** per-product, auto-decrement on `confirmed`, restore on cancel/return.
- **Accounts:** running-ledger + low-balance alerts.
- **Risk:** keep weighted score, ADD delivery-rate column.
- **Integrations:** Google Drive + Calendar (OAuth), no Slack.

---

## 14a — Orders status model rework (core)

Read: `src/lib/statuses.ts`, `status-pill.tsx`, `status-select.tsx`,
`orders/all/orders-all-table.tsx`, `order-workflow.tsx`, `orders/actions.ts`,
`supabase/migrations/00009_order_transitions.sql`, `00004_orders.sql` (o_sel/
o_upd policies + `order_status_history` trigger).

1. **Free status changes within role (drop the transition graph).** The graph
   lives only in `statuses.ts` `next[]` + `transitionsFor()`; the DB RPC checks
   role, not the graph. Change `transitionsFor(kind, current)` (or add
   `allStatuses(kind)`) so `<StatusSelect>` offers **every** status of that kind,
   not just `next`. `requiresConfirm` still applies (e.g. cancelled/returned).

2. **RLS: agents see all, role gates writes.** New migration:
   - `o_sel`: broaden to `workspace_id = current_workspace_id()` for all
     authenticated roles (remove the phase-based hiding). This also deletes the
     00009 "blind spot" — a confirmed order no longer leaves the confirmation
     agent's visible set, so they can reopen a misclick.
   - `transition_order_status` RPC role check → : admin may set anything;
     `confirmation_agent` may set `confirmation_status` to ANY value;
     `delivery_agent` may set `delivery_status` to ANY value. (Rewrite the
     `v_conf = 'confirmed'` gate accordingly.)
   - Keep `guard_order_fields` for direct-UPDATE field limits. Confirm money
     stays hidden: `orders.sale_price`/`delivery_fee` are UI-gated by `showMoney`
     (=isAdmin), and cost/expense tables remain admin-only — unchanged.

3. **One "Status" column in the UI.** In `orders-all-table.tsx` (and anywhere
   both pills render side by side) collapse to a single Status cell: show
   `delivery_status` when `confirmation_status === 'confirmed'`, else
   `confirmation_status`. Helper e.g. `currentStatus(order)` in `statuses.ts`
   returning `{ kind, key }`. Removes one column.

4. **One-word labels + icon.** Icons already exist per status. Add `.short`
   message keys (e.g. `status.confirmation_status.wait_for_confirmation.short`
   = "Waiting" / "في الانتظار") in `src/messages/{en,ar}.json` for every
   confirmation + delivery status. Give `<StatusPill>` a compact mode (icon +
   short label) used in tables; keep full labels in the order-detail workflow.

5. **Narrow the table.** `order_number`, `placed_at`, `product` columns have no
   width cap — add width/`max-w` + `truncate` (add `width?: string` to the
   `Column` type in `data-table/types.ts` only if absent).

6. **Status-history popover.** History already exists (`order_status_history`
   with actor + from→to + timestamp) and renders via `<OrderTimeline>` on the
   detail page + all-orders sheet. Add a click/hover on the Status cell that
   opens the same timeline in a popover (actor names + date/time). No new data.

7. **Edit status from the single column** anywhere (all-orders sheet included):
   wire `<StatusSelect>` (role-scoped groups) to `updateOrderStatus`, so you no
   longer must be on the confirmation/delivery page to change status.

Regen types if the migration adds anything. This is a full session on its own.

---

## 14b — Exchange, Swap & return-fee default

Read: `statuses.ts`, `enums.ts`, `orders/actions.ts`, `00001_core.sql`
(`delivery_status` enum), the 14a status helper.

- **Return fee default 150.** Set the `return_fee` seed/default to `{amount:150}`
  (check `00007_seed.sql` / `00014_option_sets.sql` + the settings default). No
  new plumbing — finance/income already applies `returned × return_fee.amount`.
- **`exchange` status** (migration: `alter type delivery_status add value
  'exchange'`). In `statuses.ts` add to `DELIVERY_STATUS` (icon `Repeat`).
  Semantics: reachable from `delivered`; from `exchange` → `delivered` (swap
  done) or `returning`. Since transitions are now free (14a), this is mainly the
  enum + label + icon + `.short` + EN/AR messages + `enums.ts` list.
- **`swap` status + linked order.** client A returns → send that item to client B.
  - Migration: `alter type delivery_status add value 'swap'`; add self-FK
    `orders.swapped_to_order_id uuid references orders(id)` (and read the reverse
    for A's link). Icon e.g. `ArrowLeftRight`.
  - Action `swapOrder(orderId, newCustomer)` (admin/delivery): sets A's
    `delivery_status='swap'`, creates a NEW order for client B (new customer/
    address/phone, same product/qty, `confirmation_status='confirmed'`,
    `delivery_status` at the appropriate start), links A→B via
    `swapped_to_order_id`. B's order flows normally; A's history shows the swap.
  - UI: a "Swap to new customer" action on a returned/returnable order opening a
    small form (customer + address + wilaya). Show the A↔B link on both detail
    pages.
  - Stock: the swapped item is already out of stock (A never returned it to
    warehouse), so **do not** re-decrement for B. Note this for 14d.

---

## 14c — Finance → Accounts (running ledger)

New admin-only feature. Read: `finance/*`, `finance-tabs.tsx`, `00002_settings.sql`
+ `00003_products.sql` (expenses/ad_spend), the new-table checklist in CLAUDE.md.

- **Schema:** `accounts` (id, workspace_id, name, `currency` currency_code,
  `opening_balance`, `low_balance_threshold`, is_active, timestamps) +
  `account_topups` (account_id, amount, occurred_on, note). Add nullable
  `account_id` FK to `expenses` and `ad_spend_daily`. Balance is **derived**:
  `opening_balance + Σtopups − Σexpenses.amount − Σad_spend.amount` in the
  account's own currency (`amount`, not `amount_dzd`). Expose `account_balances`
  view.
- **RLS:** admin-only (financial). `set_updated_at` + `audit_row()` triggers.
  Add to `docs/DB.md`.
- **UI:** `finance/accounts` tab — accounts list with balance + low-balance
  `<Chip token="danger">` when `balance ≤ threshold`; add/edit account; record
  top-up; **Account** selector (Radix Combobox) in expense + ad-spend forms;
  low-balance banner on finance overview.
- ponytail: no separate ledger table — expenses/ad_spend ARE the debits.

---

## 14d — Stock hub + auto-decrement

Read: `00003_products.sql` (`products.stock`, `stock_movements`,
`apply_stock_movement`, `stock_reason` enum), `products/[id]/stock/page.tsx`,
`enums.ts` (`LOW_STOCK_THRESHOLD`). Depends on 14b for the swap note.

- **Auto-decrement trigger** (migration): on `orders` update, when
  `confirmation_status` goes INTO `confirmed` (`OLD IS DISTINCT FROM NEW`), insert
  `stock_movements` `delta=−quantity` (new `stock_reason` `order_confirmed`).
  Going OUT of confirmed (→cancelled/no_answer/…) or on `returned`, insert
  `+quantity` (`order_reverted`/`order_returned`). **Do NOT** re-decrement for a
  swap's new order (14b). Reuse `apply_stock_movement`; never touch
  `products.stock` directly. Guard against double-fire.
- **Stock hub page** (`/app/products/stock` sub-tab, or a Stock nav item — match
  `nav-model.tsx` IA): all products with current stock, low/out `<StatusPill>`
  badges (`≤ LOW_STOCK_THRESHOLD` low, `≤0` out), quick manual adjust, link to
  per-product movement log. Four states. Low-stock count on the nav counter if easy.

---

## 14e — Rules redesign

Read: `team/rules/page.tsx`, `team/actions.ts` (saveRuleDoc/deleteRuleDoc/
moveRuleDoc), `rules_docs` table.

- Read view by default with an **Edit button** revealing the form inline (not
  always-open). **Category color** per rule via a `category` column (option_set
  `rule_category`: `must`, `product_choice`, `new_product_task`, `delivery`)
  rendered as a colored `<Chip>`/`<StatusPill>`.
- Seed the user's example rules verbatim (EN + AR):
  - **Must:** respect meeting times; deliver orders on time.
  - **Product choice:** ≥2 creatives; no competitor OR ≥1 competitor; seasonal.
  - **New-product tasks (each assigned to a team member):** check pricing; find
    the tissu + contact the fournisseur; prepare creatives; prepare product page;
    launch the ads; compare the metrics.
- Keep move up/down + delete. ponytail: plain textarea + category, no rich text.

---

## 14f — Users + Audit → Settings

Read: `nav-model.tsx`, `team/team-tabs.tsx`, `settings/page.tsx`, `team/page.tsx`
(users), `team/audit/page.tsx`.

- Move **Users** (`/app/team`) and **Audit** (`/app/team/audit`) into Settings
  (match settings' section-anchor pattern, or sub-routes). Update `nav-model.tsx`
  (drop from team group) + `team-tabs.tsx`. Team keeps rules/meetings/tasks/
  performance. Keep RLS/guards (both already admin-only). Grep for dead links
  (`/app/team$`, `/app/team/audit`), fix i18n labels.

---

## 14g — Analytics: delivery rate + timing stats

Read: `00006_analytics.sql` (`customer_stats`, `agent_performance`,
`product_stats`), `team/performance/page.tsx` + `performance-table.tsx`. The
explainer `docs/PRICING_AND_RISK.md` is already written.

- **Customer delivery-rate column.** `customer_stats` already has
  `delivered_orders` + `total_orders` — surface `delivered/total` as `40% (2/5)`
  beside the risk badge on customer/contact views (guard /0 → "—"). No new query.
- **Timing stats (extend, don't rebuild).** `agent_performance` already computes
  `avg_decision_time` (placed → first confirm/cancel = **avg confirmation time**).
  Add to the view: **avg delivery time** (`confirmed` ts → `delivered` ts) and
  **avg total time** (placed → `delivered`), from `order_status_history`
  timestamps. Surface all three on the performance page (per agent, already
  filtered by date) and as workspace averages (e.g. on the dashboard or finance
  overview). `formatDuration()` already renders intervals — reuse it.
- ponytail: pull the confirmed/delivered timestamps from `order_status_history`
  in the same view; no new table.

---

## 14h — Google Drive + Calendar (OAuth) — LAST

> **Full spec + Sonnet prompt: `docs/phases/phase-14h-google-oauth.md`.**
> Blocked on the user's Google Cloud console setup (that file's §0). Do not
> start until 14a–14g are merged.
