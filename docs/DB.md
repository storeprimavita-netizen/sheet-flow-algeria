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
| `stock_movements` | 00003, 00018 | trigger maintains `products.stock`; reasons purchase/correction/order_confirmed/order_reverted/order_returned (legacy: delivered/returned) | admin only |
| `customers` | 00004 | keyed unique (workspace, normalized phone); trigger normalizes | all read, admin write (webhook uses service role) |
| `contacts` | 00004 | suppliers only (shooting_studio/atelier_couture/emballage/other), phones[] | admin only |
| `orders` | 00004, 00014 | see SPEC §3; unique (workspace, source, external_id); optional `cancellation_reason_option_id` (FK → `options`, set when confirmation/delivery status goes cancelled/returned) | admin all; conf agent: `confirmation_status <> 'confirmed'`; delivery agent: confirmed only |
| `order_status_history` | 00004 | stage/from/to/comment/actor/ts; written by trigger | read with parent order |
| `cash_collections` | 00004 | COD cash → deposit reconciliation | admin only |
| `order_tags` | 00014 | join table (order_id, option_id) — multi-select tags, own `workspace_id` for RLS | all read/insert/delete (tagging isn't financial) |
| `rules_docs` | 00005 | markdown blocks | all read, admin write |
| `meetings` / `meeting_objectives` | 00005 | trigger: no 'held' without objectives | all read, admin write |
| `zr_territories` | 00012 | cached ZR Express wilaya/commune territory tree (id/code/name/level/parent_id), refreshed by an admin "Sync territories" action — used to resolve `orders.wilaya_code`/`commune` into ZR's own territory UUIDs when pushing a parcel | admin only |
| `zr_shipments` | 00012 | one row per order pushed to ZR Express: `parcel_id`, `tracking_number`, `state` (their workflow state name, free text — not mapped onto our `delivery_status`) | all read, admin write |
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
4. `orders_stock_effects` — confirmed ⇒ stock −qty (`order_confirmed`); leave-confirmed pre-delivery ⇒ +qty (`order_reverted`); returned ⇒ +qty (`order_returned`) via `stock_movements`.

## Views (00006, all `security_invoker` — caller's RLS applies)

| View | Feeds |
|---|---|
| `customer_stats` | Contacts page + confirmation queue inline risk. Risk formula documented in the migration + SPEC §5; weights from `settings.risk_weights` |
| `wilaya_stats` | Dashboard per-wilaya table; `stop_shipping_auto` computed from `settings.stop_shipping_rule` (min_orders + min_delivery_rate), `stop_shipping_manual` from `wilaya_fees` |
| `agent_performance` | Team & Rules; per actor+stage: handled, confirmed/delivered, avg decision time |
| `product_stats` | Product Statistics tab + "Real" pricing scenario; money columns null for agents (admin-only source tables) |
| `account_balances` | Finance → Accounts page + low-balance banner on overview; derived balance per account |

Dashboard aggregate RPC(s) get added in the BI phase as migration
`00008_dashboard.sql` (security invoker, filter params).

## `settings` keys (seeded per workspace)

| Key | Default | Used by |
|---|---|---|
| `return_fee` | `{"amount": 100}` | returned-order expense computation |
| `duplicate_window` | `{"hours": 48}` | duplicate trigger |
| `risk_weights` | `{"returned":2,"cancelled":1,"no_answer":0.5}` | `customer_stats` |
| `stop_shipping_rule` | `{"min_orders":10,"min_delivery_rate":40}` | `wilaya_stats` |
| `meeting_schedule` | 2 slots/week | meetings page |

## Financial-effects rule

`delivered` revenue and `returned` return-fee expenses are **always computed**
(views/queries over orders + settings), never written into rows. The only
stored money is what a human entered (expenses, ad spend, costs, fees, rates).
