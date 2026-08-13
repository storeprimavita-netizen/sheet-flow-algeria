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

### GLM 5.2 execution brief

Traced against current code (post-14a: `00015_free_status_transitions.sql`;
`statuses.ts` already has `allStatuses`/`statusOptionsFor`/`currentStatus` +
free confirmation/delivery transitions). 14b is enum+labels+icon+one action+
one card+default bump — no RPC rewrite, no new history/stock code.

**Files to touch (exact):**
- `supabase/migrations/00016_exchange_swap.sql` (NEW) — see skeleton.
- `src/lib/enums.ts` — add `"exchange"`, `"swap"` to `DELIVERY_STATUSES`
  (z.enum gate for `updateDeliveryStatus`/`bulkTransition`; without it the
  status-select rejects the new values).
- `src/lib/statuses.ts` — add to `DELIVERY_STATUS`: `exchange` (token `info`,
  icon `Repeat`), `swap` (token `indigo`, icon `ArrowLeftRight`); both
  `next: []` (free transitions make `next` cosmetic for orders). Import both
  from `lucide-react`. `currentStatus()`/`statusOptionsFor()` need NO change.
- `src/messages/en.json` + `src/messages/ar.json` — add to
  `status.delivery_status` (full label: "Exchange"/"Swap" + AR) and to
  `status.short.delivery_status` ("Exchange"/"Swap" + AR short). Add a small
  `orders.swap.*` block (title, fields, submit, link labels) — same shape as
  existing `orders.*`.
- `src/lib/settings.ts:30` — `return_fee: { amount: 150 }` (runtime fallback).
- `supabase/migrations/00007_seed.sql:31`, `00014_option_sets.sql:124` (the
  `seed_workspace()` insert), `00002_settings.sql:32` comment — all
  `100` → `150` (fresh-`db reset` consistency).
- `src/app/app/orders/actions.ts` — add `swapOrder(orderId, formData)`
  (admin-only, see stale-decision note). Mirror `createOrder`:
  `adminProfile()` → zod-parse new customer (name/phone/wilaya/commune/
  address) → `upsertCustomerFromOrder` → INSERT B (source `'manual'`,
  copy A's `product_id`/`variant`/`quantity`/`sale_price`/`delivery_fee`/
  `delivery_type`; new customer snapshot + wilaya/commune/address;
  `confirmation_status='confirmed'`, `delivery_status='wait_for_deposit'`,
  `placed_at=now`) → set A `delivery_status='swap'` + `swapped_to_order_id=B`
  (transition RPC for A's status; plain admin `.update` for the link col) →
  `revalidatePath` + `redirect(/app/orders/${B.id})`.
- `src/app/app/orders/[id]/swap-card.tsx` (NEW, client) — admin-only; a
  `<details>`/form revealed by a "Swap to new customer" button, shown when
  A's `delivery_status ∈ {returning, returned, exchange, delivered}`. Fields
  use `components/fields/*` (no raw input) + Radix Select for wilaya (reuse
  the order-form wilaya list pattern). Also renders the A↔B link: if
  `order.swapped_to_order_id` → link to B; else show A (found by the page's
  reverse query).
- `src/app/app/orders/[id]/page.tsx` — fetch the reverse link
  (`select id,order_number,customer_name from orders where workspace_id=$ws
  and swapped_to_order_id = $order.id limit 1`) and pass `swappedFrom` +
  the order's own `swapped_to_order_id` into `<SwapCard>`. Mount `<SwapCard>`
  alongside `AssignmentCard`/`ZRShipmentCard`.
- `src/lib/supabase/database.types.ts` — regen (`npx supabase gen types
  typescript --linked` after pushing 00016, or `--db-url` local + hand-merge
  per Phase 7 precedent) so `delivery_status` enum + `swapped_to_order_id`
  column typecheck.

**Migration skeleton (`00016_exchange_swap.sql`):**
```sql
alter type public.delivery_status add value if not exists 'exchange';
alter type public.delivery_status add value if not exists 'swap';

alter table public.orders
  add column if not exists swapped_to_order_id uuid references public.orders(id) on delete set null;
create index if not exists orders_swapped_idx on public.orders (workspace_id, swapped_to_order_id);

-- Locked decision: return_fee default 150 DZD. Bump only untouched workspaces
-- (still at the old 100 default) so a workspace that customized it is preserved.
update public.settings
  set value = '{"amount": 150}'
  where key = 'return_fee' and (value->>'amount')::numeric = 100;
```
(`ALTER TYPE … ADD VALUE` is fine inside Supabase's per-file transaction —
PG ≥12 allows it; we don't *use* the new values in this same migration.)

**Order of steps:** migration 00016 → push + regen types → enums.ts +
statuses.ts + settings.ts + seed/comment edits → messages EN/AR →
`swapOrder` action → `swap-card.tsx` + page wiring → build → test →
screenshots (status pill in both themes + swap form + A↔B link).

**Locked decisions — confirmed vs stale:**
- ✓ Exchange after `delivered`; `exchange`→`delivered`/`returning` reachable
  (free transitions, no graph work).
- ✓ Swap = A's return → new linked order for B; one `swapped_to_order_id`
  column, A→B forward, B's page reverse-queries A (no second column).
- ✓ Return-fee default 150 — confirmed in all 3 seed/default spots.
- ✓ Stock not re-decremented for B — safe by existing trigger shape (below).
- ⚠ **STALE: "`swapOrder` (admin/delivery)".** RLS makes it **admin-only**:
  `o_ins` (orders insert, 00004 L293) is `and is_admin()`, and `cu_all`
  (customers insert) is admin-only — a delivery_agent cannot insert B's order
  or B's customer. `swapOrder` uses `adminProfile()` like `createOrder`/
  `pushOrderToZRExpress`. Elevating delivery agents to swap needs a
  security-definer RPC + new insert policies — out of scope, defer (note in
  PROGRESS handoff).

**Edge cases / gotchas traced:**
- **RPC unchanged.** `transition_order_status` (00015) params are typed
  `delivery_status` and the role-check gates *which* param is set, not the
  value — adding enum values makes `exchange`/`swap` settable by
  delivery_agent automatically. A's `delivery_status='swap'` goes through it.
- **History is automatic.** `log_order_status` (AFTER INSERT OR UPDATE,
  00004 L176) logs A's swap transition on update AND B's initial confirmed
  status on insert — no history code.
- **Stock is safe for B — and flag for 14d.** `order_stock_effects`
  (00004 L228) is `AFTER UPDATE` only, so B's INSERT never fires it even
  though B is created `confirmed`. 14d's planned auto-decrement trigger MUST
  stay UPDATE-scoped (`OLD IS DISTINCT FROM NEW`), never `after insert or
  update` — or B (created already-confirmed) would wrongly decrement stock.
  Write this into 14d's brief when it lands.
- **`flag_duplicate_order`** (BEFORE INSERT) may flag B as a duplicate of A
  if the admin reuses the same phone+product within the window — arguably
  correct (same item, same phone); not a bug, just expected.
- **swapOrder atomicity:** upsert customer → insert B → update A in sequence
  (server actions aren't cross-call transactional). If A's update fails after
  B inserts, B is just a normal confirmed order — acceptable at this volume;
  a `swap_order()` definer RPC is the upgrade path if orphaned Bs ever bite.
- **B's commercial fields** inherit A's (sale_price/fee/type/variant/qty);
  B's wilaya may differ so its real delivery_fee should be edited by hand
  after — ponytail (copy A's, admin adjusts), don't rebuild the wilaya-fee
  resolver here.

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

### GLM 5.2 execution brief

Traced against current code (post-14b: 00016_exchange_swap.sql is latest migration;
finance layout uses `AdminGuardLayout`; no `finance/actions.ts` exists — expense/ad-spend
actions live in `products/actions.ts`).

**Files to touch (exact):**

**Migration:**
- `supabase/migrations/00017_accounts.sql` (NEW) — see skeleton below.

**Schema/types:**
- `src/lib/supabase/database.types.ts` — regen after push.
- `docs/DB.md` — add `accounts`, `account_topups`, `account_balances` rows to tables
  table + note the nullable `account_id` on expenses/ad_spend.

**Backend actions:**
- `src/app/app/finance/accounts/actions.ts` (NEW) — `saveAccount(formData)` (zod:
  name, currency, opening_balance, low_balance_threshold, is_active) + `saveTopup(formData)`
  (zod: account_id, amount, occurred_on, note). Both use `adminProfile()`. `revalidatePath`
  for finance routes.
- `src/app/app/products/actions.ts` — add `account_id: nullableUuid` to `expenseSchema`
  (L134) and `adSpendSchema` (L211). Both upserts already spread `...input` so the FK
  passes through with zero other changes.

**UI — accounts page:**
- `src/app/app/finance/accounts/page.tsx` (NEW) — server component. Fetches accounts
  + `account_balances` view + topups. Four states. Renders `<AccountTable>`.
- `src/components/finance/account-table.tsx` (NEW) — list of accounts: name, currency,
  opening balance, current balance (from view), low-balance `<Chip token="danger">`
  when `balance ≤ low_balance_threshold`. Add/edit button opens inline form. Top-up
  button opens inline form.
- `src/components/finance/account-form.tsx` (NEW, client) — name, currency
  (`<EnumSelect>` from CURRENCY_CODES), opening_balance, low_balance_threshold,
  is_active toggle. Posts `saveAccount`.
- `src/components/finance/topup-form.tsx` (NEW, client) — amount, occurred_on, note.
  Posts `saveTopup`. Minimal.

**UI — wiring accounts into existing forms:**
- `src/components/finance/expense-form.tsx` — add optional Account combobox field
  (loads accounts from server, passes `account_id`). New `<AccountCombobox>` or reuse
  existing `<EnumSelect>` with `__none` sentinel (same pattern as supplier select L113–119).
  Ponytail: `<EnumSelect>` is simpler than a new combobox for a short list — accounts
  will typically be 1–3 per workspace.
- `src/components/finance/ad-spend-form.tsx` — same account selector addition.

**UI — tab/nav wiring:**
- `src/app/app/finance/finance-tabs.tsx` — add `{ key: "accounts", href:
  "/app/finance/accounts", label: t("accounts") }` to tabs array. Type union grows by
  `"accounts"`.
- `src/components/nav-model.tsx` — add `{ key: "accounts", href:
  "/app/finance/accounts", icon: Landmark }` (from lucide-react) to finance children.
- `src/app/app/finance/overview/page.tsx` — fetch `account_balances` view, render
  low-balance banner (`balance ≤ threshold` for any active account) above the KPI cards.
  Banner: `<div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">`
  listing which accounts are low.

**i18n:**
- `src/messages/en.json` — add `nav.accounts: "Accounts"` + `accounts.*` block
  (title, subtitle, fields: name/currency/openingBalance/lowBalanceThreshold/isActive/
  amount/occurredOn/note, actions: create/edit/topup, empty/balance/lowBalance banner).
- `src/messages/ar.json` — same shape in AR.

**Migration skeleton (`00017_accounts.sql`):**
```sql
-- accounts (admin-only financial — tracks spending budgets)
create table public.accounts (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces(id) on delete cascade,
  name                   text not null,
  currency               currency_code not null default 'DZD',
  opening_balance        numeric(12,2) not null default 0,
  low_balance_threshold  numeric(12,2) not null default 0,
  is_active              boolean not null default true,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index accounts_ws_idx on public.accounts (workspace_id);

-- account_topups (deposits/recharges)
create table public.account_topups (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  amount       numeric(12,2) not null check (amount >= 0),
  occurred_on  date not null default current_date,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index account_topups_account_idx on public.account_topups (account_id, occurred_on desc);

-- nullable FK on existing tables (backward-compatible, no trigger rewrite)
alter table public.expenses
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.ad_spend_daily
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Derived balance view (security invoker — RLS applies)
create view public.account_balances as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.currency,
  a.opening_balance,
  a.low_balance_threshold,
  a.is_active,
  coalesce(a.opening_balance, 0)
    + coalesce((select sum(t.amount) from public.account_topups t where t.account_id = a.id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.account_id = a.id), 0)
    - coalesce((select sum(s.amount) from public.ad_spend_daily s where s.account_id = a.id), 0)
  as balance
from public.accounts a;

-- Triggers
do $$ begin
  create trigger set_updated_at before update on public.accounts
    for each row execute function public.set_updated_at();
end $$;

create trigger audit_accounts after insert or update or delete on public.accounts
  for each row execute function public.audit_row();
create trigger audit_topups after insert or update or delete on public.account_topups
  for each row execute function public.audit_row();

-- RLS: admin-only (financial)
alter table public.accounts enable row level security;
alter table public.account_topups enable row level security;

create policy accts_adm on public.accounts for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
create policy topups_adm on public.account_topups for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
```

**Order of steps:**
1. Migration 00017 → push + regen types
2. `docs/DB.md` table entries
3. `finance/accounts/actions.ts` (saveAccount, saveTopup)
4. `products/actions.ts` — add `account_id` to expense/ad-spend schemas
5. i18n EN/AR (`accounts.*` block + `nav.accounts`)
6. UI components: `account-form.tsx`, `topup-form.tsx`, `account-table.tsx`
7. `finance/accounts/page.tsx` — mount table
8. Wire existing forms: `expense-form.tsx` + `ad-spend-form.tsx` account selector
9. Tab/nav wiring: `finance-tabs.tsx` + `nav-model.tsx`
10. Low-balance banner on `finance/overview/page.tsx`
11. Build → screenshots (accounts page, low-balance chip, account selector in expense
    form, banner on overview — both themes)

**Locked decisions — confirmed vs stale:**
- ✓ Admin-only RLS — accounts are financial, same pattern as expenses/ad_spend.
- ✓ Balance derived (not stored) — view sums opening_balance + topups − expenses −
  ad_spend, matching plan. No `amount_dzd` needed on accounts since balance is in the
  account's own currency.
- ✓ Ponytail: expenses/ad_spend ARE the debits, no separate ledger.

**Edge cases / gotchas traced:**
- **View is security invoker.** The `account_balances` view joins accounts → topups →
  expenses → ad_spend. Since all four tables are admin-only RLS and the view is
  `security invoker` (default), the caller's RLS applies on the base tables. No
  data leak. The view must NOT be `security definer`.
- **No `amount_dzd` in balance view.** Balance sums `amount` (not `amount_dzd`) per
  plan — accounts track one currency, so mixing `amount_dzd` (which is always DZD-
  converted) would be wrong for USD/EUR accounts. Each account's expenses/ad_spend
  must share that account's currency for the balance to be meaningful. This is a
  user responsibility, not enforced at DB level — ponytail (users will naturally
  match currency; adding a CHECK constraint is a future upgrade).
- **Existing expenses/ad_spend with no account_id** are unaffected — `account_id` is
  nullable, backward-compatible, the view's subqueries use `where e.account_id = a.id`
  so unassigned rows don't count.
- **No `set_updated_at` on `account_topups`.** Topups are append-only (no edits), so
  no update trigger needed. If topup editing is ever needed, add it then.
- **`account_topups` has `workspace_id`** for RLS even though `account_id` FK already
  implies workspace — the existing pattern requires it on every table (RLS policy
  checks `workspace_id = current_workspace_id()` directly).
- **Expense/ad-spend forms pass account_id as hidden or EnumSelect.** The `<EnumSelect>`
  pattern with `__none` sentinel (same as supplier select in `expense-form.tsx` L113–119)
  works for 1–3 accounts. If the list grows long later, swap to a combobox.
- **Finance overview banner fetch.** The overview page already does 3 Promise.all fetches.
  Add `account_balances` to an existing or new query — it's a view, so `supabase
  .from("account_balances").select(...)` works directly.
- **No changes to `dashboard_stats` RPC.** The dashboard already aggregates expenses/
  ad_spend by product. Account tracking is orthogonal — it doesn't change revenue,
  invested, or net_profit computations.

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

### GLM 5.2 execution brief

Traced against current code (post-14b: latest *committed* migration is
`00016_exchange_swap.sql`; `00017_accounts.sql` exists only in the **uncommitted
14c tree** on branch `mnw-14c`). **This brief assumes 14c merges first** — the
14d migration is `00018_stock_confirm.sql` (renumber to 00017 only if 14c is
discarded). 14d touches `products`/`stock_movements`/`orders` triggers only, so
the uncommitted 14c (accounts) tree does not contaminate the analysis — but it
MUST be resolved before 14d EXECUTE so the migration numbering is clean.

**The load-bearing fact (the plan text was incomplete here):** the existing
`order_stock_effects()` trigger (`00004_orders.sql` L213-230, `AFTER UPDATE on
orders`, SECURITY DEFINER) ALREADY manages stock — but at the **delivery** point,
not confirmation:
```sql
if new.delivery_status = 'delivered' and old.delivery_status <> 'delivered' then
  insert ... delta = -new.quantity, reason = 'delivered' ...
elsif new.delivery_status = 'returned' and old.delivery_status <> 'returned' then
  insert ... delta = +new.quantity, reason = 'returned' ...
```
The 14d locked decision ("auto-decrement on `confirmed`, restore on
cancel/return") **moves the decrement point from `delivered` to `confirmed`**.
This is therefore a **rewrite of `order_stock_effects()`, not an addition** —
appending confirm-logic without removing the delivered-branch would
double-decrement every order on its happy path (−1 at confirm, −1 at deliver)
and double-restore on return. `stock_movements.order_id` (nullable FK, 00003
L114 + FK 00004 L98-100) already exists. `apply_stock_movement()` (00003
L121-131, SECURITY DEFINER, `AFTER INSERT on stock_movements`) is reason-agnostic
— any `stock_movements` insert applies its delta to `products.stock`, so the
rewritten trigger just inserts rows and the existing apply-trigger does the rest.
The three new reasons (`order_confirmed`/`order_reverted`/`order_returned`) do
NOT exist in the `stock_reason` enum (`00001_core.sql` L22: only
`purchase`/`correction`/`delivered`/`returned`) — must be added or the inserts
throw.

**Files to touch (exact):**

**Migration:**
- `supabase/migrations/00018_stock_confirm.sql` (NEW) — see skeleton.

**Schema/types/docs:**
- `src/lib/supabase/database.types.ts` — regen after push (the `stock_reason`
  union gains three values; the trigger writes them as SQL string literals but
  regen keeps the TS union accurate).
- `docs/DB.md` — update the `stock_movements` row (L58: reasons →
  `purchase`/`correction`/`order_confirmed`/`order_reverted`/`order_returned`,
  legacy `delivered`/`returned`) and the `orders_stock_effects` trigger note
  (L82-83: `confirmed ⇒ −qty`; leave-confirmed pre-delivery `⇒ +qty`; `returned ⇒
  +qty`).

**Backend — none new.** The existing `addStockMovement(productId, formData)`
(`src/app/app/products/actions.ts` L194-208) is reused as-is by the hub. Its
`revalidatePath` (L207) widens from `/app/products/${productId}/stock` to ALSO
cover `/app/stock` and `/app/products` so the hub + list totals refresh after a
manual adjust. (`MANUAL_STOCK_REASONS` stays `purchase`/`correction`; the new
`order_*` reasons are trigger-only, exactly as `delivered`/`returned` were.)

**UI — stock hub page:**
- `src/app/app/stock/page.tsx` (NEW, server component) — behind `AdminGuardLayout`
  via a one-line `layout.tsx` re-export (same pattern as `orders/cash`,
  `contacts/suppliers`). Fetch `products` (id, name, sku, stock) ordered stock asc.
  Four states. Render a table: product (link → `/app/products/[id]`), sku, current
  stock, low/out badge, and a per-row inline manual-adjust
  `<form action={addStockMovement.bind(null, product.id)}>` (delta number + reason
  `<EnumSelect options={MANUAL_STOCK_REASONS}>` + note + submit) — identical
  fields to `products/[id]/stock/page.tsx` L48-68. "Log" link →
  `/app/products/[id]/stock`.
- `src/app/app/stock/layout.tsx` (NEW) — `export { default } from
  "@/components/admin-guard-layout"`.

**Stock badge — reuse, don't rebuild:** the products list ALREADY renders stock +
low-stock badges via `StockChip` (`src/app/app/products/products-view.tsx`
L229-238: `out = stock <= 0`, `low = !out && stock <= LOW_STOCK_THRESHOLD`, `<Chip
token="danger|warning|neutral">`). The hub reuses this exact logic (the plan's
"`<StatusPill>`" is stale — this codebase uses `<Chip>` for stock levels). The hub
is mostly new *aggregation* (cross-product view + per-row adjust), not new badge
rendering.

**UI — nav wiring:**
- `src/components/nav-model.tsx` L53 — Products is a flat leaf today (`{ key:
  "products", href: "/app/products", icon: Package, adminOnly: true }`). Add a
  **peer leaf** immediately after it: `{ key: "stock", href: "/app/stock", icon:
  Boxes, adminOnly: true }` (import `Boxes` from `lucide-react`). Do NOT promote
  Products to a group — that forces a nav-expand UI for one child, bigger diff
  for no gain.
- `src/messages/en.json` + `ar.json` — add `nav.stock` ("Stock"/"المخزون") and
  `stock.reasons.{order_confirmed,order_reverted,order_returned}` (EN + AR) so the
  per-product movement log renders the new trigger-written reasons (the log shows
  `reason` via `<Chip>`). A small `stock.hub.*` block (title/subtitle/empty/adjust)
  if the hub needs copy beyond reused keys.

**Migration skeleton (`00018_stock_confirm.sql`):**
```sql
-- 14d: move the stock decrement point from delivery_status to confirmation_status.
-- Confirmed ⇒ reserve stock; leave-confirmed (pre-delivery) ⇒ restore; returned ⇒ restore.
alter type public.stock_reason add value if not exists 'order_confirmed';
alter type public.stock_reason add value if not exists 'order_reverted';
alter type public.stock_reason add value if not exists 'order_returned';

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is null then return new; end if;

  -- (1) order confirmed for shipping ⇒ stock leaves inventory
  if new.confirmation_status = 'confirmed' and old.confirmation_status <> 'confirmed' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, -new.quantity, 'order_confirmed', new.id, auth.uid());

  -- (2) delivered order returned to warehouse ⇒ stock restored
  elsif new.delivery_status = 'returned' and old.delivery_status <> 'returned' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, new.quantity, 'order_returned', new.id, auth.uid());

  -- (3) confirmed order falls back (cancelled/no_answer/reopened) before delivery ⇒ restore.
  --     Guard: only if it never reached a delivered-family state (item not in customer's hands).
  elsif old.confirmation_status = 'confirmed' and new.confirmation_status <> 'confirmed'
        and old.delivery_status not in ('delivered','returned','exchange','swap') then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, new.quantity, 'order_reverted', new.id, auth.uid());
  end if;
  return new;
end; $$;
```
The trigger itself `orders_stock_effects after update on orders` (00004 L228-230)
is unchanged — only the function body is replaced. `ALTER TYPE … ADD VALUE` is
fine in the same migration (PG ≥12, and we don't use the new values in a
constraint within this file).

**Order of steps:**
1. Resolve the 14c tree first (merge `mnw-14c` → `mnw`, or discard) — 14d branches
   from `mnw` and needs 00017 committed to number 00018 correctly.
2. Branch `mnw-14d`. Migration 00018 → push + regen types.
3. `docs/DB.md` updates.
4. Widen `addStockMovement`'s `revalidatePath`.
5. `stock/page.tsx` + `stock/layout.tsx`.
6. `nav-model.tsx` peer leaf + i18n EN/AR.
7. Build → test → screenshots (hub table + low/out chips + inline adjust; and the
   per-product movement log showing an `order_confirmed` row after confirming an
   order — both themes).

**Locked decisions — confirmed vs stale:**
- ✓ Decrement on `confirmed` (not delivered) — locked in the backlog. **Stale
  detail:** the plan reads as "add a confirm decrement"; the real task is
  **rewrite** (the existing trigger decrements at `delivered`; that branch is
  removed). Calling this out because a naive append would double-decrement.
- ✓ Restore on leave-confirmed (`order_reverted`) and on `returned`
  (`order_returned`) — implemented, with a delivery-family guard on the revert
  branch so a confirmed-then-delivered order whose confirmation is later reopened
  doesn't wrongly restore (the item already shipped).
- ✓ Do NOT re-decrement for swap's new order B — automatic: the trigger is
  `AFTER UPDATE` only, and B is created via INSERT already-confirmed (14b
  `swapOrder`), so B never fires it. Flip side: **any order born `confirmed` at
  INSERT is exempt from stock reservation** — today only swap does that (manual
  `createOrder` and webhooks start `wait_for_confirmation`, confirmed via UPDATE).
  A future feature that inserts confirmed orders must UPDATE-into-confirmed to
  reserve stock, or the trigger must gain an AFTER INSERT branch (which 14b
  explicitly forbade for swap — don't add one casually).
- ✓ Reuse `apply_stock_movement` / never touch `products.stock` directly — the
  rewritten trigger only inserts `stock_movements`; the existing
  `stock_movements_apply` trigger maintains `products.stock`.
- ✓ `stock_movements.order_id` already wired — no new column.

**Edge cases / gotchas traced:**
- **No extra idempotency needed beyond crossing guards.** Each branch fires only
  on a status *crossing* (`new = X and old <> X`), so re-saving the same status is
  a no-op and confirm→reopen→reconfirm cycles net to zero (each in-crossing −qty
  matched by an out-crossing +qty when eligible). There is no `(order_id, reason)`
  unique constraint and none should be added — it would break legitimate reconfirm
  cycles; the incremental model is already self-correcting.
- **`delivered` + `returned` enum values become legacy.** The rewritten
  return-branch uses `order_returned`; old `delivered`/`returned` stay in the type
  (PG can't drop enum values cheaply) but are no longer inserted. Pre-14d
  `stock_movements` rows with `delivered`/`returned` reasons remain valid history
  — not migrated. `products.stock` (a running total) stays consistent across the
  cutover; historical movements will simply mix `delivered` and `order_confirmed`
  reasons.
- **`exchange` / `swap` delivery statuses are stock-neutral.** Exchange (size
  change) and swap (item re-routed to another customer) intentionally produce no
  movement — exchange is a wash within the same item; swap's item already left at
  A's confirm and B is INSERT-exempt. Both are in the revert-branch exclusion list
  so reopening their confirmation doesn't restore either.
- **Single UPDATE that sets confirmation=confirmed AND delivery=delivered at
  once** (admin via RPC, both params): only branch (1) fires (−qty); branch (3)
  can't (old.confirmation wasn't confirmed). No double. Stock is correct.
- **Hub is admin-only, no new money exposure.** `products` is all-read/admin-write,
  `stock_movements` admin-only (00003 L162-179) — unchanged. Stock isn't a
  financial table; the hub sits behind `AdminGuardLayout` matching the Products
  family. No RLS change, no `dashboard_stats`/`product_stats` impact (analytics
  key off order statuses, not stock).
- **Nav low-stock counter — deferred.** `nav-model` supports `counter` (orders
  uses it), but a low-stock count means extending the app-shell's counter fetch.
  The plan says "if easy"; it isn't trivial — skip, leave a `ponytail:` note. The
  hub itself is the low-stock surface.
- **`addStockMovement` returns `void` (throws on error), not `{ok,error}`.** The
  per-row inline `<form action>` re-renders the page on success and surfaces
  errors via the nearest error boundary — no toast needed. Refactor the return
  shape only if the hub later wants inline validation feedback.

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
