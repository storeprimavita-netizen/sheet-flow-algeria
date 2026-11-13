> **Superseded in part (2026-10-21):** delivery-agent findings assume an internal delivery role; see DECISIONS D9/D10. There is no delivery agent.

# Council F - QA/release review (read-only)
Tests: with LOCAL_SUPABASE_URL=http://127.0.0.1:54321 (stack already up, seeded) vitest = 83/83 pass, 0 skipped.
Secrets: origin/main history has only Lovable-era anon keys (public by design, old project) + local demo service_role (iss supabase-demo) in docs/phases/phase-12-sonnet-handoff.md. kimi.tx / zip are gitignored, not in history of any ref. No live secret found tracked.
Findings (impact x likelihood):
1 MED-HIGH spec drift: 00015 o_sel lets agents read ALL orders incl sale_price/quantity/delivery_fee/phones across workspace (supabase/migrations/00015_free_status_transitions.sql:14-17); revenue computable via API. SPEC 2 says financial blind. Add RLS test or column-level view.
2 MED agent direct UPDATE gaps: guard_order_fields (00004_orders.sql:123-146) only blocks status cross-stage + price/fee/product/qty; agents can still edit customer_name/phone/address, assigned_*_agent, wilaya_code, delivery_type via PostgREST.
3 MED webhook redelivery overwrites admin edits: src/lib/webhook.ts ~L225-250 update(logistics) sets product_id null (unmatched), sale_price, quantity, customer fields on every resend/replay; comment claims "logistics only".
4 MED unauthenticated Shopify/Lightfunnels webhooks insert a webhook_events row per bad request (webhook.ts ~L296-310), 256KB cap, no rate limit/cheap pre-reject (ZR has one). DB flood. Also no replay window/timestamp on those two.
5 MED P&L accuracy (00022_pnl.sql:49-60): COGS = 0 for orders with null product_id (webhook unmatched) -> profit overstated; revenue/COGS by placed_at while delivery lands later; when filtered by product, ad/expense scope is product-only but agent/wilaya filters (p_filtered) do not scale ad spend/expenses; return cost = flat settings.return_fee while scenario engine (pricing.ts:166) uses delivery_fee ratio -> two models.
6 LOW deploy: .env* gitignored so .env.local.example not committed (.gitignore:34) -> no env template; docs/TESTING.md references supabase/docker-compose.yml and config.toml that do not exist in repo (only migrations); no CI, no vercel.json; migrations 00020-24 not pushed to remote (user TODO); no CSP; mnw is 135 commits ahead, no upstream, origin/main is unrelated Lovable history (657 files diff) - push as new branch/force decision.
7 LOW team/meetings/[id]/page.tsx:47 uses service-role listUsers(perPage 1000) for any viewer; only same-workspace profiles mapped, but pagination cap and needless service role in a page.
8 LOW updateUser (settings/users/actions.ts) lets admin demote/deactivate self or last admin; no last-admin guard.
9 LOW webhook matchProduct/matchWilaya use substring fuzzy matching -> wrong product/wilaya mapping silently (webhook.ts ~L100-150).
Role checks: all server actions in products/settings/team/contacts/finance use requireAdminProfile; orders actions rely on RPC + admin checks; RLS tests cover financial tables and cross-workspace. Good.
How to run skipped tests: start local supabase (already running as supabase_db_mnw-erp), seed `node --env-file=.env.local scripts/seed-dev.ts`, then `LOCAL_SUPABASE_URL=http://127.0.0.1:54321 npm test`.
