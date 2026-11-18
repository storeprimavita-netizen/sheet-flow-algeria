# Database — v2 schema reference

Migrations: `supabase/migrations/00001_core.sql` … `00007_seed.sql`.
Everything is workspace-scoped and RLS-enabled. Legacy v1 schema:
`supabase/migrations_legacy/` (do not apply).

## Applying the rebaseline (Phase 0)

Dev data is disposable (user-confirmed). On the linked project:

```sql
-- Dashboard SQL editor — nuke the v1 public schema objects
drop schema public cascade; create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
```

Then `npx supabase db push` (files apply in order), sign up the admin at
`/login`, and run `select public.bootstrap_workspace('sh.wailbmg@gmail.com', 'MNW');`
— it creates the workspace, promotes the user, and seeds wilaya fees + settings.
Finally regenerate types:
`npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Helper functions

| Function | Purpose |
|---|---|
| `current_workspace_id()` | Active user's workspace (null if inactive) — used in every policy |
| `current_app_role()` / `is_admin()` | Role checks (security definer, no RLS recursion) |
| `normalize_dz_phone(text)` | 05/06/07, +213, 00213, spaces → `0XXXXXXXXX` |
| `current_fx_rate(ws, currency)` | Latest manual rate (DZD=1) |
| `bootstrap_workspace(email, name)` | One-shot first workspace + admin + seed |
| `seed_workspace(ws)` | Idempotent per-workspace defaults (58 fee rows + settings) |
| `audit_row()` | Generic audit trigger fn → `audit_log` |
| `transition_order_status(order_id, confirmation_status?, delivery_status?, comment?)` | Security-definer status transition (00009) — a plain agent `UPDATE` moving `confirmation_status` to `'confirmed'` fails RLS because the post-update row no longer satisfies the agent's own SELECT policy; re-checks authorization manually and bypasses that. Used by every agent-facing status change instead of `.update()`. |

## Tables (all have `workspace_id` unless noted)

| Table | File | Notes | RLS |
|---|---|---|---|
| `workspaces` | 00001 | SaaS root (no workspace_id) | members read, admin update |
| `profiles` | 00001 | user↔workspace↔role + duty + is_active; replaces v1 `user_roles`+`team_roles`. New signups: inactive, no workspace. Guard trigger: only admins change role/workspace/activation | team read; self/admin update |
| `audit_log` | 00001 | generic who/what/old→new; written by `audit_row()` triggers on settings-ish tables + expenses + product_costs | admin read |
| `wilayas` | 00002 | static 58-row national reference (no workspace_id) | all read |
| `wilaya_fees` | 00002 | home/stopdesk fee + manual `stop_shipping` per wilaya | all read, admin write |
| `settings` | 00002 | key/value jsonb — keys listed below | admin only |
| `fixed_fees` | 00002 | monthly fixed costs (label, amount, currency, fx, generated `amount_dzd`) | admin only |
| `exchange_rates` | 00002 | manual date-stamped USD/EUR→DZD; latest wins | admin only |
| `integration_configs` | 00002 | per provider: config jsonb, secret, `last_event_at` health | admin only |
| `webhook_events` | 00002 | raw payloads for debug/replay; written by service role | admin read |
| `products` | 00003, 00014 | NON-financial only: name, `category_option_id`/`fabric_option_id` (FK → `options`, was free text before 00014), status, sale_price, variants jsonb, images, stock, notes | all read, admin write |
| `product_costs` | 00003 | 1:1 sourcing cost + currency + fx (the split enforces agent financial blindness) | admin only |
| `product_scenarios` | 00003 | BENZ inputs jsonb per slug best/medium/worst; `product_id null` = general planner (partial unique indexes) | admin only |
| `expenses` | 00003, 00014, 00017 | multi-currency + generated `amount_dzd`; optional product/supplier link; optional `subcategory_option_id` (FK → `options`); optional `account_id` (FK → `accounts`) | admin only |
| `ad_spend_daily` | 00003, 00017 | unique (product, day, kind test/scaling); optional `account_id` (FK → `accounts`) | admin only |
| `accounts` | 00017 | spending budget accounts (name, currency, opening_balance, low_balance_threshold); `account_topups` for deposits; balance derived via `account_balances` view | admin only |
| `account_topups` | 00017 | append-only deposits (account_id, amount, occurred_on, note) | admin only |
| `stock_movements` | 00003, 00018, 00028 | ADD-ONLY log (D35): policies select + insert (admin; insert only `purchase`/`correction` with no order); UPDATE/DELETE/TRUNCATE revoked and a trigger refuses them except FK cascades (order gone -> `order_id` null; product/workspace gone -> delete). Trigger maintains `products.stock` = pieces in the warehouse and refuses a movement whose workspace is not the product's (D30). Reasons: purchase/correction (manual), order_shipped/order_returned/order_swapped/order_stock_sync (order trigger), legacy order_confirmed/order_reverted/delivered/returned | admin only |
| `customers` | 00004 | keyed unique (workspace, normalized phone); trigger normalizes | all read, admin write (webhook uses service role) |
| `contacts` | 00004 | suppliers only (shooting_studio/atelier_couture/emballage/other), phones[] | admin only |
| `orders` | 00004, 00014 | see SPEC §3; unique (workspace, source, external_id); optional `cancellation_reason_option_id` (FK → `options`, set when confirmation/delivery status goes cancelled/returned) | admin all; conf agent: `confirmation_status <> 'confirmed'`; delivery agent: confirmed only |
| `order_status_history` | 00004 | stage/from/to/comment/actor/ts; written by trigger | read with parent order |
| `cash_collections` | 00004 | COD cash → deposit reconciliation | admin only |
| `order_tags` | 00014 | join table (order_id, option_id) — multi-select tags, own `workspace_id` for RLS | all read/insert/delete (tagging isn't financial) |
| `rules_docs` | 00005 | markdown blocks + `category` text col (14e) | all read, admin write |
| `meetings` / `meeting_objectives` | 00005 | trigger: no 'held' without objectives | all read, admin write |
| `zr_territories` | 00012 | cached ZR Express wilaya/commune territory tree (id/code/name/level/parent_id), refreshed by an admin "Sync territories" action — used to resolve `orders.wilaya_code`/`commune` into ZR's own territory UUIDs when pushing a parcel | admin only |
| `zr_shipments` | 00012 | one row per order pushed to ZR Express: `parcel_id`, `tracking_number`, `state` (their workflow state name, free text), `state_slug`, `occurred_at` (state ts, stale guard), `situation`/`is_return`/`situation_at` (own ts); unique (workspace_id, parcel_id). 00027: `apply_zr_state(..., p_live)` (service_role only) stores state if newer and syncs `orders.delivery_status` from the STORED state via `settings.zr_state_map` in one txn under the row lock; `webhook_events` unique (provider, workspace_id, external_id) | all read, admin write |
| `option_sets` | 00014 | user-editable taxonomies (key, label, allows_multi) — see `.claude/skills/cod-ui-polish/references/option-sets.md`. 5 seeded: `product_category`, `product_fabric`, `expense_subcategory`, `order_tag` (multi), `cancellation_reason` | all read, admin write |
| `options` | 00014 | one row per value in a set (label, color_token, icon, sort_order, archived_at) — referencing tables store the option **id**, never the label | all read+insert (inline "+ Create"), admin update/delete (rename/recolor/reorder/archive/merge) |

## Order triggers (00004)

1. `orders_guard_fields` — agents can't cross stages nor touch
   price/fee/product/qty; service role (webhooks) bypasses.
2. `orders_log_status` — initial statuses on INSERT + every transition on
   UPDATE → `order_status_history` (this is the timestamp source for agent
   stats and time-to-confirm).
3. `orders_flag_duplicate` — BEFORE INSERT: same normalized phone + product
   within `settings.duplicate_window` hours ⇒ `is_duplicate_suspect = true`,
   `duplicate_of` set.
4. `orders_stock_effects` (00028, D34/D31/D30) — AFTER INSERT OR UPDATE OF delivery_status, confirmation_status, quantity, product_id, swapped_to_order_id. `order_stock_target(status, qty, is_linked_original, is_replacement, confirmation_status)` is the ONLY stock rule (00030, D43: 0 first when the order is a swap replacement with `confirmation_status = 'cancelled'` and still `wait_for_deposit`; other orders keep their carrier-held stock; trigger also fires on `confirmation_status`): 0 when the order is linked to its replacement (`swapped_to_order_id` set); `-qty` from `bureau_deposited` on (bureau_deposited, in_transit, out_for_delivery, stop_desk_waiting, delayed, returning, exchange, delivered), and for a swap replacement already in `wait_for_deposit`; else 0 (wait_for_deposit, returned, cancelled, swap). `stock_reconcile_order()` (internal, not granted to API roles) sums the order's movements for the product (reasons order_confirmed/order_reverted/order_returned/order_stock_sync/order_swapped/order_shipped + legacy delivered/returned) and inserts one `target - current` movement. Reasons: order_shipped (leaves to carrier), order_returned (back), order_swapped (link), else order_stock_sync. Changing product releases the old one first; a link change also reconciles the replacement; `orders_stock_release` (BEFORE DELETE, D41) gives pieces back only for pre-pickup/cancelled/returned orders and swap replacements (on road/delivered keep them out; correct via the log); `orders_stock_after_delete` reconciles the replacement of a deleted original; a swap link to another workspace raises (D30); `products_stock_guard` refuses direct `products.stock` changes (only via a movement, D35). 00029 ran the reconcile once over existing orders (idempotent).
5. `swap_order(...)` (00028, 00030; security invoker, admin only; D43: sets the transaction-local flag `mnw.swap_status`, without which a BEFORE INSERT/UPDATE trigger `orders_swap_status_guard` on `orders` refuses `delivery_status = 'swap'` for every caller incl. admin and service role (`apply_zr_state` skips a map entry to swap); `swap` is also excluded from manual/bulk/carrier-map status lists) — locks original A; returns the existing B on double submit; A must have a product, status returning/returned/exchange/delivered, customer in A's workspace; creates confirmed `wait_for_deposit` B, moves A to `swap` through `transition_order_status`, links `swapped_to_order_id` (trigger reconciles A and B).

## Views (00006, all `security_invoker` — caller's RLS applies)

- `product_stock_stages` (00028) — per product: `in_stock` (= products.stock), `reserved` (confirmed + wait_for_deposit, not a replacement, not a linked original), `on_road` (target < 0, not delivered), `delivered`. Calls `order_stock_target`; `where is_admin()`, select-only for `authenticated` (00030 revokes insert/update/delete/truncate from every API role). 00030 also pins `search_path = public, pg_temp` on every public security definer function and requires `created_by = auth.uid()` on manual stock log inserts.

| View | Feeds |
|---|---|
| `customer_stats` | Contacts page + confirmation queue inline risk. Risk formula documented in the migration + SPEC §5; weights from `settings.risk_weights` |
| `wilaya_stats` | Dashboard per-wilaya table; `stop_shipping_auto` computed from `settings.stop_shipping_rule` (min_orders + min_delivery_rate), `stop_shipping_manual` from `wilaya_fees` |
| `agent_performance` | Team performance page; per actor+stage: handled, confirmed/delivered, avg decision/delivery/total time |
| `workspace_performance` | Team performance page header strip; same three timings, workspace-wide (00020) |
| `product_stats` | Product Statistics tab + "Real" pricing scenario; money columns null for agents (admin-only source tables) |
| `account_balances` | Finance → Accounts page + low-balance banner on overview; derived balance per account |

Dashboard aggregate RPC(s) get added in the BI phase as migration
`00008_dashboard.sql` (security invoker, filter params).

## `settings` keys (seeded per workspace)

| Key | Default | Used by |
|---|---|---|
| `return_fee` | `{"amount": 150}` | returned-order expense computation |
| `duplicate_window` | `{"hours": 48}` | duplicate trigger |
| `risk_weights` | `{"returned":2,"cancelled":1,"no_answer":0.5}` | `customer_stats` |
| `stop_shipping_rule` | `{"min_orders":10,"min_delivery_rate":40}` | `wilaya_stats` |
| `meeting_schedule` | 2 slots/week | meetings page |
| `zr_state_map` | `{"map": {}}` | ZR state name (lower-cased) → `delivery_status`; applied by the ZR webhook (15f) |
| `zr_auto_push` | `{"enabled": false}` | push a ZR parcel when an order is confirmed (15f) |

## Financial-effects rule

`delivered` revenue and `returned` return-fee expenses are **always computed**
(views/queries over orders + settings), never written into rows. The only
stored money is what a human entered (expenses, ad spend, costs, fees, rates).

## Service-role uses (documented exceptions)

- Webhook route handlers (Shopify, Lightfunnels, ZR Express) — no user session.
- Invites (`settings/users/actions.ts`) — creating auth users.
- **ZR auto-push on confirm** (`orders/actions.ts` → `pushToZR`, 15f): the
  confirming agent can't read the ZR API key or the admin-only `settings`
  row, so after the agent's RLS-checked `transition_order_status` succeeds,
  the push + flag read run with the service role, scoped to the caller's
  workspace and that one order.
