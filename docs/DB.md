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
| `kpi_order_set(from, to, product, filters)` | 00061 (STATS-3): the one order set. `filters` jsonb keys `category` (option uuid), `wilaya`, `source`, `agent` (confirmation agent), `delivery_type`; compared as text, never cast; null / `{}` = none; non-object, unknown key or non-string value = zero rows. `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders` take the same `p_filters`; `kpi_set_rates(from,to,product,filters)` = `kpi_rates` of that set (admin only, no id round trip) |
| `audit_row()` | Generic audit trigger fn → `audit_log`; old/new pass through `audit_redact()` (00033) |
| `audit_redact(jsonb)` (+ `audit_redact(jsonb,int)`, `audit_is_secret_key(text)`) | **00071 (SEC-1-G): SQL and TS give identical output on every `PARITY_CASES` entry and the function is idempotent (`f(f(x)) = f(x)`, also at the 64-level cap and `TS(SQL(x)) = SQL(x)`): a string that is exactly `[redacted:<8 hex>]` is returned unchanged at any depth, and a secret key whose value is `''` or already masked is kept at the cap instead of being hashed again. The name separator is any character outside `[a-zA-Z0-9]` (was `- . space :`; one char per code point in both twins); plurals `secretkeys`/`privatekeys` are masked. Corner: `/sort_key`, `@cache_key`, `$color_token` were masked under 00037 and are visible now (allow-listed after normalising). The audit page shows a pill for any value matching the mask token, including values masked at the cap under non-secret keys.** Stable, not callable by anon/authenticated. Fail closed (D49, 00035; acronyms + depth cap 00036): a JSON key, or the `key` of a `{key, value}` row, is masked when its last segment is `key(s)`, `token(s)`, `secret(s)`, `password`/`passwd`/`pwd`/`passphrase`, `credential(s)`, `authorization`, `signature`, or one of the run-together forms `apikey`, `secretkey`, `accesstoken`, `authtoken`, `privatekey`, `clientsecret`, `webhooksecret`, `bottoken` (00037), under EITHER normalisation: (a) trim spaces, split acronyms (`XAPIKey` → `XAPI_Key`) and camelCase, any char outside `[a-zA-Z0-9]` → `_`, lowercase, trim `_`; (b) case-only (catches `sEcReT`). Allow-list: `key`/`keys`, `idempotency_key`, `sort_key`, `cache_key`, `(color\|design\|theme)_token(s)`. Masks the whole value (any JSON type) → `[redacted:<sha256 first 8 hex>]`; also string values starting `whsec_`/`sk_`/`shpss_`/`shpat_`/`Bearer `. Subtrees deeper than 64 levels are masked whole, except JSON null (00038), the empty string `""` (00072) and an already-masked `[redacted:<8 hex>]` string, which are kept at any depth. Fingerprints of non-strings hash jsonb text; the TS twin (`src/lib/audit-redact.ts`) reproduces it exactly for strings, integers up to 2^53, null, booleans, `{}`/`[]` and nested objects/arrays including non-ASCII keys (keys ordered by UTF-8 byte length like jsonb); floats and integers beyond 2^53 are NOT guaranteed to match (shared case table `audit-redact.cases.ts`, live parity test). 00036 backfill rewrites only changed `audit_log` rows |
| `transition_order_status(order_id, confirmation_status?, delivery_status?, comment?)` | Security-definer status transition (00009) — a plain agent `UPDATE` moving `confirmation_status` to `'confirmed'` fails RLS because the post-update row no longer satisfies the agent's own SELECT policy; re-checks authorization manually and bypasses that. Used by every agent-facing status change instead of `.update()`. |

## Tables (all have `workspace_id` unless noted)

| Table | File | Notes | RLS |
|---|---|---|---|
| `workspaces` | 00001 | SaaS root (no workspace_id) | members read, admin update |
| `profiles` | 00001 | user↔workspace↔role + duty + is_active; replaces v1 `user_roles`+`team_roles`. New signups: inactive, no workspace. Guard trigger: only admins change role/workspace/activation | team read; self/admin update |
| `audit_log` | 00001 | generic who/what/old→new; written by `audit_row()` triggers on settings-ish tables + expenses + product_costs. Audit page date filters use a fixed Algeria zone (+01:00, no DST); there is no workspace timezone setting. | admin read |
| `wilayas` | 00002 | static 58-row national reference (no workspace_id) | all read |
| `wilaya_fees` | 00002 | home/stopdesk fee + manual `stop_shipping` per wilaya; 00052 adds `priced` (false = no price, shipping off) and `stopdesk_available` (false = home-only); 00055 adds CHECKs: `not priced or home_fee > 0` and `not (priced and stopdesk_available) or stopdesk_fee > 0` (0 is never a price, D62) | all read, admin write |
| `wilaya_communes` | 00052 | commune names per wilaya, replaced by `apply_delivery_prices(jsonb)` (admin RPC, security invoker); fees read via `delivery_fee_for(ws, wilaya, type)` (null = unavailable) | all read, admin write |
| `settings` | 00002 | key/value jsonb — keys listed below | admin only |
| `fixed_fees` | 00002 | monthly fixed costs (label, amount, currency, fx, generated `amount_dzd`) | admin only |
| `exchange_rates` | 00002 | manual date-stamped USD/EUR→DZD; latest wins | admin only |
| `integration_configs` | 00002 | per provider: config jsonb, secret, `last_event_at` health | admin only |
| `webhook_events` | 00002 | raw payloads for debug/replay; written by service role | admin read |
| `products` | 00003, 00014 | NON-financial only: name, `category_option_id`/`fabric_option_id` (FK → `options`, was free text before 00014), status, sale_price, variants jsonb, images, stock, notes | all read, admin write |
| `product_costs` | 00003 | 1:1 sourcing cost + currency + fx (the split enforces agent financial blindness) | admin only |
| `product_pricing` | 00039 | per-product pricing overrides (jsonb, fractions), ad costs `ad_*_usd`, `final_price`; PK product_id; composite FK (product_id, workspace_id) -> products so a row cannot point at another workspace's product; audited (row_id null: no `id`); absent row = all defaults | admin only |
| `product_options`, `product_option_values`, `product_variants`, `product_variant_values` | 00042-00048 | STORE-1 (D54, D55): options (Size, Color), their values, the sizes (variants) and the join (one value per option). Every child carries `product_id`; composite FKs `(id, product_id)` keep a tree inside one product and one workspace; `product_id` immutable (trigger); a deferred trigger refuses two variants with the same value set. Variant `stock` starts at 0 and changes only through a movement (guard like `products_stock_guard`), may go below 0 (D54.3). Variants are deactivated (`is_active`), never deleted once an order or movement references them (NO ACTION FK). Options and values are audited. `orders` and `stock_movements` gain `variant_id` (FK `(variant_id, product_id)`); `orders.variant` is a label snapshot written by a trigger from `variant_id`; `stock_movements.count_id` links the two lines of a count. `products.variants` (jsonb) is kept, no longer edited. Data migration 00043 is idempotent. Views: `product_variant_stock_v` (not assigned = total - every variant, `count_needed`). Function `stock_count_variants(product, counts)` (security definer, admin only, absolute counts, two linked `stock_count` lines per changed size). Function `save_variant_config(product, config)` (00048, security invoker, RLS is the wall; advisory lock per product; one transaction for options, values and sizes; refuses `stale` when the option ids differ from the stored ones once a size has values, and ids of another product; labels parked so two can be swapped; an existing size only gets `sku` and `is_active`; revoked from public, anon and service_role). Deferred constraint triggers (00048): every size that has values has exactly one per option of its product. 00065 hardens both: the trigger takes the product advisory lock first; the save deletes dropped values and options before the upserts (a label can be removed and re-added in one save); a NEW size must carry exactly one value per payload option (`incomplete size`). 00066: zero options refused, `values` must be an object, stale (option set fixed) once ANY size exists. 00067: a deferred trigger refuses a value-less size written by a signed-in user (direct insert or deleting all value rows; service_role exempt), and a value must belong to its key's option (`incomplete size`). 00070 (STORE-1-G): `authenticated` loses TRUNCATE/TRIGGER/REFERENCES on these four tables (SELECT/INSERT/UPDATE/DELETE stay, RLS gates them); a BEFORE UPDATE trigger refuses any change to an existing `product_variant_values` row (all columns are identity), incl. the `INSERT .. ON CONFLICT DO UPDATE` path; a `-- guard:begin` block aborts the migration if any size has no value rows. Accepted: a direct product delete can hit 40P01 against a concurrent `save_variant_config` (the delete takes row locks then the advisory lock, the save the reverse); no screen deletes products. No anon grant or execute | agents read, admin write; no cost fields |
| `stores`, `store_pages` | 00049 | STORE-2: public storefront. `stores` (slug unique globally, reserved words refused, `status` draft/live, `settings` jsonb with contact info only, never secrets, `theme`); `store_pages` (`kind` product/content, product link, `blocks` jsonb text-only, `seo`, `status` draft/published; a published product page needs a product). Composite FKs keep store, product and workspace together; `workspace_id` immutable; audited. Public pages are read only through the server-only DAL (service role) which returns published-only cost-free DTOs. No anon grant, no authenticated TRUNCATE/TRIGGER/REFERENCES | `stores`: all roles read, admin writes; `store_pages`: admin only |
| `product_offers`, `product_forms` (+ price columns) | 00077 | STORE-3: `products.pricing_mode` (uniform / per_value / per_variant) and `compare_at_price` (no CHECK against `sale_price`: hidden in code when <= price); `product_option_values.price_delta` and `product_variants.price_override` / `compare_at_override` are integer DZD (column-scoped audit on variants). `product_offers`: `kind` quantity (qty 2..50, `total_price` > 0, one default per product) or bump (one per product, `bump_product_id` composite FK `ON DELETE SET NULL`, trigger refuses self, inactive, unpriced or sized bump products), `label` <= 60, optional active window. NO free-delivery column (D60). `product_forms`: one row per product, `fields` jsonb array (< 16 kB, validated again by zod at read), `delivery_methods` non-empty subset of home/stopdesk. `workspace_id` and `product_id` immutable; audited; no anon grant, no authenticated TRUNCATE/TRIGGER/REFERENCES | all roles read, admin writes |
| `reviews` | 00064 | STORE-7: customer reviews an admin records (no public submission). `rating` 1..5, `name` <=80, `body` <=1000, `approved` default false, optional `order_id` (composite FK, set null) used only to compute the verified mark in the DAL. Composite FKs to products (cascade) and orders; `workspace_id` immutable; audited. Public reads go through the server-only DAL (service role): approved only, DTO without ids. No anon grant | admin only |
| `product_scenarios` | 00003 | BENZ inputs jsonb per slug (unused since PRICE-4, not dropped: destructive, owner decides) | admin only |
| `expenses` | 00003, 00014, 00017 | multi-currency + generated `amount_dzd`; optional product/supplier link; optional `subcategory_option_id` (FK → `options`); optional `account_id` (FK → `accounts`) | admin only |
| `ad_spend_daily` | 00003, 00017 | unique (product, day, kind test/scaling); optional `account_id` (FK → `accounts`) | admin only |
| `accounts` | 00017 | spending budget accounts (name, currency, opening_balance, low_balance_threshold); `account_topups` for deposits; balance derived via `account_balances` view | admin only |
| `account_topups` | 00017 | append-only deposits (account_id, amount, occurred_on, note) | admin only |
| `stock_movements` | 00003, 00018, 00028 | ADD-ONLY log (D35): policies select + insert (admin; insert only `purchase`/`correction` with no order); UPDATE/DELETE/TRUNCATE revoked and a trigger refuses them except FK cascades (order gone -> `order_id` null; product/workspace gone -> delete). Trigger maintains `products.stock` = pieces in the warehouse and refuses a movement whose workspace is not the product's (D30). Reasons: purchase/correction (manual), order_shipped/order_returned/order_swapped/order_stock_sync (order trigger), legacy order_confirmed/order_reverted/delivered/returned | admin only |
| `customers` | 00004 | keyed unique (workspace, normalized phone); trigger normalizes | all read, admin write (webhook uses service role) |
| `contacts` | 00004 | suppliers only (shooting_studio/atelier_couture/emballage/other), phones[] | admin only |
| `order_counters` | 00050 | ORD-1 (D57): one row per workspace, `next_seq`; RLS on, no policy, all grants revoked from anon/authenticated (service role has SELECT only; writes happen in the security-definer trigger). Row created by trigger on `workspaces` | nobody via API |
| `order_views` | 00056, 00057 | CONF-1: saved order views (filters+sort+stored columns); `owner_id` null = shared, else personal; `seed_key` marks seeded shared views (`new`, `no_answer`, `duplicates`), seeded by trigger on `workspaces` + backfill, a deleted seed never returns; owner/workspace immutable; 00057: trimmed name, seed_key only on shared rows, position >= 0, DB trigger caps 20 views per (scope, shared|owner); `seed_order_views` revoked from all client roles | read shared + own; write own; admin writes shared |
| `orders` | 00004, 00014, 00050 | see SPEC §3; `order_seq` (00050, D57) = per-workspace running number shown as `#0001`, assigned by BEFORE INSERT trigger `orders_assign_seq` (security definer, ignores supplied value, never reused; gapless for plain inserts, but `INSERT … ON CONFLICT DO NOTHING` burns a number — do not upsert orders), immutable with `workspace_id` (`orders_seq_immutable`, all roles), unique (workspace_id, order_seq); `order_number` is the EXTERNAL platform ref only; unique (workspace, source, external_id); optional `cancellation_reason_option_id` (FK → `options`, set when confirmation/delivery status goes cancelled/returned) | admin all; conf agent: `confirmation_status <> 'confirmed'`; delivery agent: confirmed only |
| `order_status_history` | 00004 | stage/from/to/comment/actor/ts; written by trigger | read with parent order |
| `cash_collections` | 00004 | COD cash → deposit reconciliation | admin only |
| `order_tags` | 00014 | join table (order_id, option_id) — multi-select tags, own `workspace_id` for RLS | all read/insert/delete (tagging isn't financial) |
| `rules_docs` | 00005 | markdown blocks + `category` text col (14e) | all read, admin write |
| `meetings` / `meeting_objectives` | 00005 | trigger: no 'held' without objectives | all read, admin write |
| `zr_territories` | 00012 | cached ZR Express wilaya/commune territory tree (id/code/name/level/parent_id), refreshed by an admin "Sync territories" action — used to resolve `orders.wilaya_code`/`commune` into ZR's own territory UUIDs when pushing a parcel | admin only |
| `zr_shipments` | 00012 | one row per order pushed to ZR Express: `parcel_id`, `tracking_number`, `state` (their workflow state name, free text), `state_slug`, `occurred_at` (state ts, stale guard), `situation`/`is_return`/`situation_at` (own ts); unique (workspace_id, parcel_id). 00027: `apply_zr_state(..., p_live)` (service_role only) stores state if newer and syncs `orders.delivery_status` from the STORED state via `settings.zr_state_map` in one txn under the row lock; `webhook_events` unique (provider, workspace_id, external_id) | all read, admin write |
| `option_sets` | 00014 | user-editable taxonomies (key, label, allows_multi) — see `.claude/skills/cod-ui-polish/references/option-sets.md`. 5 seeded: `product_category`, `product_fabric`, `expense_subcategory`, `order_tag` (multi), `cancellation_reason` | all read, admin write |
| `options` | 00014, 00073, 00074 | one row per value in a set (label, color_token, `icon` (DEPRECATED, unused), `emoji` (00073, NAV-4: 1-16 chars, no control/bidi chars; only admins may set it, the insert policy refuses an emoji from agents), sort_order, archived_at) — referencing tables store the option **id**, never the label. 00074: anon has no grant (also `option_sets`) | all read+insert (inline "+ Create"), admin update/delete (rename/recolor/reorder/archive/merge) |
| `status_label_overrides` | 00073 | NAV-4: per workspace+kind+status_key display-label override (`label_en`, `label_ar`, 1..40 chars, no control/bidi chars, one at least). Display only: keys, colors, transitions stay in code. Not read by /login, store or tracking. Audited | all roles read (the app shows them to everyone), admin insert/update/delete; no anon grant, no authenticated TRUNCATE/TRIGGER/REFERENCES |
| `seasons` | 00061 | STATS-3: named seasons per workspace (name, `name_key` for the 6 seeded names, sort); unique (workspace, name) and (id, workspace); seeded by `seed_workspace` (Ramadan, Eid al-Fitr, Eid al-Adha, Summer, Back to school, Winter; no dates) | admin only |
| `season_periods` | 00061 | one date range per season and year (`year` = year of `date_from`, `date_from <= date_to`); unique (workspace_id, season_id, year); composite FK (season, workspace) -> `seasons` so a period cannot point at another workspace's season | admin only |

## anon grants (00075, NAV-4-S2)

`anon` has no grant on any relation in `public` (tables, views, sequences), and
`postgres` default privileges in `public` give it none, so new tables inherit
none. After creating a table, no anon grant is expected. Schema USAGE stays.
Check (owner, also after any remote `db push`):
`select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public';` = 0,
and no anon entry in `pg_default_acl` for `postgres`/public (r, S). Do not toggle
`auto_expose_new_tables` (config.toml) or the cloud Data API equivalent: it may
re-add anon defaults; re-run the check if toggled, and after
`supabase stop && supabase start`. `supabase_admin` default ACLs are
platform-owned and untouched (owner-only).

## anon function execute (00076, NAV-4-S3)

`anon` and PUBLIC execute no function in `public` (any prokind), and
`postgres` default privileges give anon/PUBLIC none for new functions (global
`alter default privileges for role postgres revoke execute on functions from public`
plus the anon revoke in `public`). `authenticated` and `service_role` keep what
they had (RLS helpers, dashboard_stats, current_fx_rate, kpi_*/pnl_* ...).
Two cases for a NEW function:
- In `public`: the schema default still grants execute to `authenticated` and
  `service_role`. A SECURITY DEFINER RPC must therefore also revoke from
  `authenticated` (00046 pattern) or agents can call it.
- In a new schema (e.g. `private`): nobody gets execute, so RLS policy helpers
  there need an explicit grant to `authenticated` (else 42501 for every user).
The `storage` schema default still grants anon execute (not owned here).
`supabase_admin` default ACLs are platform-owned and untouched.
Owner post-push check (expect 0 rows for postgres-owned functions; others are
only reported by the migration as a NOTICE):
`select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon',p.oid,'execute');`

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
5. `swap_order(...)` (00028, 00030; security invoker, admin only; D43: sets the transaction-local flag `mnw.swap_status`, without which a BEFORE INSERT/UPDATE trigger `orders_swap_status_guard` on `orders` refuses `delivery_status = 'swap'` for every caller incl. admin and service role (`apply_zr_state` skips a map entry to swap); `swap` is also excluded from manual/bulk/carrier-map status lists) — locks original A; returns the existing B on double submit; A must have a product, status returning/returned only (00032, D48: delivered/exchange refused, the admin creates a normal order), customer in A's workspace; creates confirmed `wait_for_deposit` B, moves A to `swap` through `transition_order_status`, links `swapped_to_order_id` (trigger reconciles A and B).

## Views (00006, all `security_invoker` — caller's RLS applies)

- `product_stock_v` (00031) — `product_stock_stages` + `sellable` (in_stock - reserved, floor 0) and `low` (sellable <= `products.low_stock_threshold`); admin-only through the view it reads, select-only for `authenticated`, nothing for anon.
- KPI contract (00031, D46, all security invoker, execute revoked from anon): `kpi_order_set(from, to, product[])` is THE order set (range = Africa/Algiers day of `placed_at`; out = `orders.excluded_reason` set, an unconfirmed duplicate suspect; a swap original stays in the set as an ordinary order, D48). `kpi_rates(order_ids, from, to)` returns `{confirmation, delivery, return, delivered_of_confirmed: {num, den, value 0..1, matured}, counts}`; D47/D48: a swap original is an ordinary order of the set (selected by its own day, wilaya, product; counts in received, confirmed, decided, `of_received`) and adds 1 to returned in the delivery/return denominators and the return numerator (`counts.swapped`); never a sale or return fee, and a later carrier delivered/returned status on it is ignored. `delivered_of_confirmed` = confirmed-and-delivered own orders / confirmed (originals included), one set, <= 1 (kept in the contract, not read by the app, D67; the Real scenario reads `confirmation.value` and `delivery.value`); matured constants (den >= 10, unresolved of all ages <= 20% of den + unresolved; unresolved = waiting for confirmation, or confirmed and not delivered/returned/cancelled) live in `kpi_metric`/`kpi_rates`. `kpi_lines(order_ids|null, from, to, product[], filtered)` adds on_road (orders and units, ignores eligibility and dates, same rule as `product_stock_stages`) and, for admins only, money (latest USD rate per D45, waterfall that sums to net_profit, `pnl`); `kpi_summary(from, to, product)` selects its own set; `pnl_summary`, `pnl_by_product` (now also returns `kpi`), `dashboard_stats` (new key `kpi`), `wilaya_stats` and `product_stats` all consume the same set. `orders.excluded_reason` (duplicate|test|fake|other) is admin-only by the 00025 column allow-list.
- Statistics (00058, D64; 00060 also gates `kpi_group_extras` on `is_admin()`): `kpi_by_wilaya(from, to, product[])` and `kpi_by_commune(wilaya, from, to, product[])` group `kpi_order_set` by `wilaya_code` / `nullif(lower(trim(commune)),'')` (null = unknown; display spelling = mode) and return `rates` = `kpi_rates(group ids)` plus `extras` from `kpi_group_extras(ids)` (`shipped`, `home_count`, `stopdesk_count` over the delivery-rate denominator; `avg_days_to_deliver` + `avg_days_sample` for delivered non-swapped orders, from `coalesce(placed_at, created_at)` to the `delivered` history entry). security invoker, execute revoked from public/anon, and they return zero rows unless `public.is_admin()` (D64). No money keys. No index: grouping is on an expression.
- Statistics drill (00059, D64): `kpi_drill_orders(metric, from, to, product[], wilaya, commune_key, unknown, delivery_type, offset, limit)` returns one page of order ids plus `total` for a count of `/app/statistics` (metric = received / confirmed / delivered / returned / return (= returned + swap originals, the return-rate numerator) / shipped (00063: same predicate as `kpi_group_extras.shipped`; home/stop-desk counts link here with `p_delivery_type`), same predicates as `kpi_rates` counts; same set and commune key as `kpi_by_commune`). security invoker, admin-only (zero rows otherwise), execute revoked from public/anon.
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
| `pricing_defaults` | absent = built-in `DEFAULT_PRICING_SETTINGS` (D50); sparse fractions, `target` mode+value as one unit | workspace pricing settings (PRICE-2); Settings -> Pricing; product overrides in `product_pricing` |

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
