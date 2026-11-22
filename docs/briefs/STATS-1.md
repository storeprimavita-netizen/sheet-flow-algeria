# STATS-1 — Customer score fields and reasons

risk: high · surface: security · lane: stats

Goal: give customer detail, lookup and confirmation a database contract for order history and explainable customer risk using the caller’s existing scope.

## Done when

- `customer_stats` keeps its existing keys, counts and formula for valid weights. Queryable states follow the existing badge thresholds: 0 (`neutral`), 1–29 (`warning`) and 30+ (`high`). Empty history has a null score and `new` state. A numeric returned weight of zero or less yields a null score and `unscored` when history exists. For future display filters, neutral maps to reliable, warning/high to risky, and new to new. Unscored stays separate from these bands.
- Scope is set solely from the caller role (D98): `workspace` for admins, `visible` for agents. Admins use each valid configured weight or its default for missing and nonnumeric values, with negative cancelled/no-answer weights clamped to zero. Agents use the existing 2/1/0.5 defaults. Preserve the existing order and settings policies. Agent displays and filters must identify the visible-history scope, give the visible order count and show “No visible orders” for empty history.
- Expose a stable reason tag and the existing returned, cancelled and no-answer counts. Choose the dominant strictly positive weighted contribution, with returned, cancelled, then no-answer as tie breakers. A rounded neutral score can still carry an adverse reason and counts. Distinguish no history, unscored history and no positive weighted contribution. Keep risk counts on all visible orders, including rows excluded from the KPI cohort.
- First and last order timestamps use `coalesce(placed_at, created_at)`. Return both confirmation and delivery status of the last order with a stable order-ID tie break. Per-product history counts visible orders, with one count per order. Hidden rows cannot affect the scope tag, counts, or score.
- `customer_delivery_stats` provides a separate per-customer detail read for delivery numerator, denominator, value and maturity using the caller-visible KPI cohort (D4, D46–D48). Value is null until the metric matures, including when the denominator is zero. Keep the counts so clients can explain the sample. The maturity minimum of 10 means many customer histories yield no rate.
- Lifetime delivered value is in DZD, using the same merchandise value and eligible delivered rows as the existing revenue contract. It is returned only to workspace admins. Anon and other workspaces cannot read the analytics, and agents get only fields derived from data they can already see, with no lifetime value.

## Files and order

1. `supabase/migrations/00086_customer_score.sql` (next available number): replace `public.customer_stats` in place with `security_invoker = true`. Keep existing column order and types and append the new score and history fields. Join orders on workspace and customer IDs. Validate numeric weights before casting and preserve the Settings RLS join. Use `public.is_admin()` for the scope tag and admin weight selection. No new persistent tables or base-table grants.
2. Add the invoker view `public.customer_delivery_stats` keyed by workspace and customer, including the admin-only lifetime value. Group the eligible IDs once by customer before calling `kpi_rates(...)->'delivery'`, following the grouped `wilaya_stats` pattern in `00061_seasons.sql`. Reuse `kpi_order_set` for exclusions and `public.is_admin()` around lifetime aggregation. Return a zero-count, immature metric for a visible customer with no eligible orders. Follow the KPI helper’s caller-visible replacement semantics. Existing customer list and confirmation reads of `customer_stats` do not depend on this view.
3. Add the invoker view `public.customer_product_stats` keyed by workspace, customer and product with `order_count`. Exclude null product IDs. Revoke all privileges from public, anon and authenticated on the three views, then grant authenticated SELECT. Use the existing `orders_customer_idx` for targeted lookups where appropriate.
4. Update `docs/DB.md` with fields, states, weights, visibility, eligibility and a keyed detail-read example for future UI work. Reset locally and regenerate `src/lib/supabase/database.types.ts` with the project scripts. Leave app routes and rendering for CONF-3 and later UI integration.

## Acceptance checks

- `src/lib/customer-stats.rls.test.ts` (new): “keeps the existing risk formula and weighted reason counts”. Cover ties, zero positive contribution, rounded-zero adverse evidence, malformed and negative stored weights, no history and zero returned weight. Verify date fallback, both last statuses and deterministic tie-breaking, and product order count independent of quantity.
- “uses the D4 delivery cohort and publishes a rate only when matured”. Compare numerator, denominator and maturity to `kpi_lines`. Cover pending and excluded orders, duplicate exclusions, swap originals, cancelled after pickup, a replacement whose original is outside caller visibility, and empty, immature and mature samples. Verify that admin lifetime value uses sale price × quantity and excludes swap originals and delivery fees.
- “identifies caller-visible history and keeps lifetime value admin-only”. Run real admin, confirmation-agent and legacy delivery-agent sessions against different visible subsets of the same history. Check agent defaults against configured and zero admin weights. Verify cross-workspace isolation with the same phone, anonymous denial, and SELECT-only privileges for all three views.
- Record local EXPLAIN evidence for one-customer and batched ID lookups. Confirm the cohort function executes at most once per query and the delivery computation stays off the existing customer list path.
- Run full gate with live RLS (D24). No browser checks for this data-only stage.

References: STATS §Customer score, CONF §Customer score hover card, SPEC §5, D4, D10, D11, D24, D46–D48, D98, STATS-1.review-0.
