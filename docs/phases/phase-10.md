# Phase 10 — Polish, seed data, RLS test pass, deploy

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §10 (Quality bars),
docs/TOOLING.md (§Testing).

## Goal

Production readiness: seed script, RLS verification suite, E2E pass, Vercel.

## Steps

1. **Seed script** (`scripts/seed-dev.ts`, service-role, dev only): 3 users
   (admin + both agent types), 5 products with costs/scenarios/expenses/
   ad-spend, ~60 orders across statuses/wilayas/sources/dates (some
   duplicates, some returned), fees filled for top wilayas, FX rates, 2
   meetings, rules docs. Deterministic (fixed seed) so numbers are checkable.
2. **RLS test suite** (vitest, runs against the dev project with two signed-in
   clients): for EACH financial table (product_costs, expenses,
   ad_spend_daily, fixed_fees, exchange_rates, cash_collections,
   product_scenarios, settings, audit_log, webhook_events, contacts):
   agent select ⇒ 0 rows; agent insert/update ⇒ error. Orders: agent
   visibility windows, cross-stage update rejection, cross-workspace
   isolation (create a second workspace + user; every table returns only own
   rows). This is the spec's "zero financial data reachable by agents —
   verified at RLS level with tests".
3. **E2E manual pass** (checklist in PR): webhook order → duplicate flag →
   confirm → deliver → revenue on dashboard → return flow → return fee in
   product stats → cash collection → deposit.
4. Polish: loading/empty/error states, mobile sidebar, RTL spot-check on the
   new pages, number/date formatting audit, i18n gaps (`grep` for raw
   strings), dead code removal (`graphify-out/` note, parked components not
   yet reused).
5. **Vercel**: envs (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`), deploy, run one real webhook
   against the deployed URL, update integration secrets to production
   values. Note free-tier constraints in PROGRESS.md (500 MB, pauses after
   1 week inactivity).

## Acceptance criteria

- `npm test` green including the RLS suite; `npm run build` green.
- Deployed app passes the E2E checklist.
- PROGRESS.md final entry: deployment URL, env list, known issues, backlog
  (FR locale, carrier API, SaaS signup flow, image uploads).
