# STATS-1 — Customer score fields and reasons

risk: high · surface: security · lane: stats

Goal: give customer detail, lookup and confirmation a database contract for order history and explainable customer risk using the caller’s existing scope.

## Done when

- `customer_stats` keeps its existing keys, count semantics and tunable risk formula. Expose the current tier thresholds as a queryable state using 0 (`neutral`), 1–29 (`warning`) and 30+ (`high`). With no visible order history the score is null and the state is `new`. Guard a zero returned-weight denominator with a distinct `unscored` state without changing scores for valid weights.
- The view exposes a tagged reason with counts, no English or Arabic literals. Return total visible orders and the existing returned, cancelled and no-answer counts. A signal can be explained as the dominant adverse category by weighted contribution, using returned, cancelled, then no-answer to break ties. Distinguish no history, unscorable weights and history without adverse signals.
- First and last order date use `coalesce(placed_at, created_at)`. Last status uses a stable order-ID tie break. Per-product history counts visible orders, with one count per order rather than item quantity. Operational history is caller-scoped, so an agent with no visible prior orders cannot infer history outside their scope.
- Delivery numerator, denominator, value and maturity come from the existing KPI definitions and cohort exclusions (D4, D46–D48). Return a null display value when the delivery metric is immature, including no denominator. Preserve numerator and denominator for explaining the cohort.
- Lifetime delivered value is in DZD, using the same merchandise value and eligible delivered rows as the existing revenue contract. It is returned only to workspace admins. Anon and other workspaces cannot read the analytics, and agents get only fields derived from data they can already see, with no lifetime value.

## Files and order

1. `supabase/migrations/00086_customer_score.sql` (next available number): replace `public.customer_stats` in place with `security_invoker = true`. Keep existing column order and types and append the new fields. Join orders on workspace and customer IDs. Preserve the settings join under existing RLS, including role-specific fallback weights. Study `00006_analytics.sql`, `00031_kpi_contract.sql` and the latest policy and KPI migrations before changing the view. No new persistent tables or grants to underlying tables.
2. Reuse `kpi_order_set` and `kpi_rates(...)->'delivery'`, as the chart RPCs use the same eligibility and rate helpers. Batch cohort selection and group eligible IDs once keyed by customer. Avoid calling the money-bearing `kpi_lines` for each customer or copying its rate logic. Keep the returned / cancelled / no-answer reason counts aligned with the retained score formula and independent of the delivery cohort. Use the existing `orders_customer_idx` and check a filtered lookup plan for unrelated customer fan-out.
3. Add `public.customer_product_stats` as an invoker view, keyed by workspace, customer and product with `order_count`. Exclude null product IDs. Match the operational visibility and order-count semantics of `customer_stats`. Explicitly restrict both views to authenticated SELECT for app sessions. Use the existing `public.is_admin()` check in SQL around the lifetime sum. Verify direct reads under actual session roles.
4. Update `docs/DB.md` with the field contracts, nullable scores, metric maturity and agent scope. Reset locally and regenerate `src/lib/supabase/database.types.ts` with the project script. Leave existing customer pages, confirmation rendering and the old TS display helper for CONF-3 and a later UI integration. STATS-1 supplies structured reason, history and rate fields for those consumers.

## Acceptance checks

- `src/lib/customer-stats.rls.test.ts` (new): “keeps the existing risk formula and weighted reason counts”, including multiple adverse signals, a tie, no history, and zero returned weight. Test dates, deterministic last status, and per-product order count that differs from quantity.
- “uses the D4 delivery cohort and publishes a rate only when matured”: compare fields with `kpi_lines` for eligible orders. Include pending orders, excluded orders, swap original and cancelled after pickup cases, plus immature and matured fixtures.
- “returns only caller-visible order history and hides lifetime value from agents”: use an actual agent and admin in one workspace and admin in a second workspace, with a matching customer phone across workspaces and orders outside the agent’s existing scope. Direct anon reads are refused and base RLS stays unchanged. Assert lifetime value excludes swap originals and shipping fee, and uses sale price × quantity.
- Run full gate with live RLS (D24). No browser checks for this data-only stage.

References: STATS §Customer score, CONF §Customer score hover card, SPEC §5, D4, D10, D11, D24, D46–D48.
