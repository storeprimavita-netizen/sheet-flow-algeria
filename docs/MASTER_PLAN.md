# MNW master plan (from 2026-10-21 truth pass)

Baseline: tsc clean, build green, 83/83 tests with local Supabase (`LOCAL_SUPABASE_URL=http://127.0.0.1:54321 npm test`; 43 pass + 40 skipped without it).
Council evidence: `docs/council/*.md`, `docs/COMPETITIVE_RESEARCH.md`. Decisions: `docs/DECISIONS.md`.
Every item runs Analyse → Verify → Execute → Ship (inline, see D1). Status lives in PROGRESS.md.

## P0 — launch blockers
| ID | Task | Deps | Verify | Owner action |
|---|---|---|---|---|
| P0-1 | Webhook hardening: early 401 on missing signature, content-length precheck (413), no junk rows, retention, 500 on processing failure, replay window | – | curl no-header leaves row count unchanged; oversized → 413; existing 83 tests | – |
| P0-2 | Redelivery must not overwrite admin edits (webhook.ts update path) | – | unit test: replay after admin edit keeps product/price/qty | – |
| P0-3 | ZR: `ZR_API_BASE` seam (refuse prod base outside production), fix orphan-parcel on insert failure (lookup by externalId), tests with mock server | – | mocked push test; no real parcel | ask ZR for test tenant |
| P0-4 | Agent field guard: block agent edits to name/phone/address/assignment/wilaya (D8 middle path) + RLS tests | owner D8 | rls.test.ts new cases | confirm D8 |
| P0-5 | Index + unique(cash_collections.order_id) migration; auth `cache()` memoisation | – | explain/EXPLAIN, ≤1 auth call per page | – |
| P0-6 | `db push` 00020–24 (+ new), regen types | P0-1..5 | types diff clean | **backup Supabase, run db push, rotate kimi key, delete bundle/kimi.tx** |
| P0-7 | Env template, SETUP.md rewrite, TESTING.md fix, Vercel project, preview deploy + smoke | P0-6 | smoke on real URL | create Vercel project, 4 env vars, Supabase auth URLs; choose push target (new branch vs replace main) |

## P1 — core product
| ID | Task | Notes |
|---|---|---|
| P1-1 | KPI contract migration (`orders.excluded_reason`, `kpi_lines`, `product_stock_v`) + tests | B §contract; check `ad_spend_daily.product_id` nullability first |
| P1-2 | Dashboard rebuild: hero 4 (confirmation, delivery success, CPDO, ROI), stock/alerts strip, profit-vs-spend + funnel, product CPDO bars; Suspense per section; tooltips with formulas | C wireframe; needs P1-1 |
| P1-3 | Orders table: default columns trimmed, hide-empty, filter popover, mobile cards, RTL clip check; screenshots both themes | verify C findings in live app first |
| P1-4 | COD product-page builder: pages table (+RLS), image upload via Supabase Storage (server-signed), public route `/p/[slug]` mobile-first AR/FR, server-validated order submit (server prices, idempotency key, rate limit, transactional stock), source/landing attribution, tests | biggest item; needs P0-5; own phase brief |
| P1-5 | Lists: pagination/SQL views for contacts, cash, finance overview, performance (1000-row truncation) | D P1-4 |
| P1-6 | Perf: dynamic-import d3 map, next/font, i18n namespace split, exclude webhooks from proxy | measure before/after |

## P2 — growth
Meta Ads sync (cron + campaign map + `meta` provider, fixtures only until credentials), attribution views, cost per received/confirmed/delivered, courier payment reconciliation (competitive differentiator), bulk ZR push chunking.

## P3 — later
Google Drive/Calendar OAuth (14h), CSP, last-admin guard, inviteUser orphan cleanup, further courier integrations, AI/WhatsApp confirmation.

## Risks
Cohort immaturity misleading rates (mitigated by D4); migration ordering (00024 before app deploy); Meta approval unknown for Algeria; public form abuse.
