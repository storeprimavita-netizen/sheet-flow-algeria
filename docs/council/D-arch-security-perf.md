> **Superseded in part (2026-10-21):** delivery-agent findings assume an internal delivery role; see DECISIONS D9/D10. There is no delivery agent.

# Council D — Architecture / Perf / Security audit (read-only)

Method: static read of migrations 00001-00024, server actions, pages, webhook libs. Build not re-run (no route-size output under Turbopack). Not run: RLS test suite (needs local docker).

## What is solid (don't touch)
- All 00006/00020 views are security_invoker; account_balances fixed in 00021. pnl_*/dashboard_stats are security invoker and gate money on is_admin(). Financial tables all admin-only RLS (00003:173-180, 00002:165-171, 00004:281/317, 00017:83-86). audit_log/webhook_events admin-only.
- ZR webhook: Svix HMAC, 5-min window, cheap reject before DB (zrexpress-webhook.ts:~75). Admin client is `server-only`.
- Server actions: admin ones go through requireAdminProfile(); inline zod broadly. No chart lib (custom SVG); only d3-geo + d3-delaunay as heavy deps. Dependency list is lean.

## P0 — none found (no agent-visible financial table, no cross-tenant leak).

## P1

### P1-1 transition_order_status bypasses stage visibility (integrity)
- supabase/migrations/00024:28-37. SECURITY DEFINER; checks only role vs which arg is null, never whether the order is in the caller's RLS bucket (confirmation_agent: status<>'confirmed'; delivery_agent: ='confirmed', 00004:287-291).
- Impact: a delivery agent can set `delivered` on an UNCONFIRMED order (fires stock trigger -qty); a confirmation agent can cancel/alter an already-confirmed or shipped order. Violates the "stage guard" in RLS.
- Fix (new migration 00025, ~10 lines inside the function, after the `v_ws` check): select confirmation_status into v_conf already fetched -> `if not is_admin() and ((v_role='confirmation_agent' and v_conf='confirmed') or (v_role='delivery_agent' and v_conf<>'confirmed')) then raise exception 'not authorized'`. Cost: S (30 min). Accept: add to rls.test.ts two cases (agent transition on out-of-bucket order errors; in-bucket and confirm-handoff still work).

### P1-2 Unauthenticated webhook writes a DB row per request (storage-fill / write amplification)
- src/lib/webhook.ts:282-312. Order-source routes (shopify/lightfunnel) insert into webhook_events for every POST, including missing-signature and unconfigured, then run an HMAC per workspace. ZR route already fixed this; these two weren't. body read fully before size check (line 283-284), no Content-Length precheck.
- Fix: (a) if no signature header -> 401 before any DB work; (b) check `content-length` > MAX before `req.text()`; (c) only insert a row when signatureOk or `configured`-and-bad-signature rate-limited (or drop the junk row, log to console). Plus a retention job (pg_cron delete webhook_events > 30-90d). Cost: S. Accept: curl w/o header leaves webhook_events count unchanged; 300KB body w/ content-length rejected 413 without reading.

### P1-3 Auth round-trips multiplied per navigation (no memoisation)
- src/lib/rbac.ts:14-31; src/app/app/layout.tsx:17-22; src/components/admin-guard-layout.tsx; ~30 call sites; zero `cache()` anywhere. One page view = proxy getUser (session.ts:~33) + layout getUser + getCurrentUserRole(getUser+profiles query) + each nested admin layout (finance/settings/stock/products...) getUser+profiles + page getProfile again = 5-8 Supabase auth/DB calls, serial.
- Fix: wrap `getProfile` in React `cache()` and have it use `supabase.auth.getClaims()` (local JWT verify, already supported by supabase-js 2.110) except in the proxy; have layout.tsx call getProfile() once and reuse role/user. Cost: S-M. Accept: network log of an admin page shows <=1 auth call + 1 profiles query; all RLS tests unchanged.

### P1-4 Silent truncation at 1000 rows + oversized `.in()` URLs on unbounded list queries
PostgREST caps responses at 1000 rows by default, so these lists silently lose data as volume grows; `.in("customer_id", ids)` also breaks (414/400) when ids are in the hundreds.
- src/app/app/contacts/page.tsx:38-50 (customer_stats unbounded `select *` then orders `.in(ids)` for ALL customers) — breaks first.
- src/app/app/orders/confirmation/page.tsx:22-45 (queue + `.in(customerIds)`), orders/delivery/page.tsx:22-35 (`show=all`), orders/cash/page.tsx:19-28 (every delivered order + every collection, filtered in JS), finance/overview/page.tsx:56-57 (all delivered orders + all collected cash for receivables; sum in JS -> wrong numbers past 1000), products/page.tsx:29, team/performance/page.tsx:50-60 (raw history rows to JS when a date filter is set), finance/expenses & ad-spend pages (no limit).
- Fix per page (focused): contacts -> paginate (`range`, PAGE_SIZE like orders/all/page.tsx:71) and fetch per-customer order info only for the page's ids; cash/overview receivables -> a SQL view/RPC (`delivered orders left join cash_collections where cash.id is null`, sum) instead of JS filtering; delivery/confirmation `show=all` -> range pagination; performance windowed mode -> an RPC `agent_performance(p_from,p_to)`. Cost: M (1-2 days across pages). Accept: seed 3k orders/2k customers; every list page renders correct counts/totals and no 4xx.

## P2

### P2-1 Missing indexes / non-sargable filters
- orders has no (workspace_id, placed_at) index (00004:91-96 only created_at) but dashboard/pnl filter `placed_at::date between ...` (00022:78, 00010) — cast defeats any index; rewrite as `placed_at >= v_from and placed_at < v_to+1`, add `create index orders_ws_placed_idx on orders(workspace_id, placed_at)`.
- order_status_history: only (order_id, created_at) (00004:116); agent_performance/team page filter by actor/stage/to_status/created_at -> add (stage, to_status, created_at) and (actor).
- cash_collections(order_id) no index; ad_spend_daily(ws, spent_on) only via unique prefix; orders.assigned_confirmation_agent/assigned_delivery_agent unindexed; duplicate trigger (00004 flag_duplicate_order) applies normalize_dz_phone() to every order of the product -> expression index `(workspace_id, product_id, normalize_dz_phone(customer_phone))` or store normalized phone column.
- Cost S (one migration). Accept: EXPLAIN on dashboard_stats 90-day window uses index; no seq scan on orders at 50k rows.

### P2-2 cash_collections has no unique(order_id)
- 00004:235-249 + orders/cash/actions.ts:15-35 (orderId not uuid-validated either). Double submit or two admins record a collection twice -> inflated cash/receivables. Fix: `unique (order_id) where order_id is not null` + `z.string().uuid()`. Cost S.

### P2-3 Whole i18n catalog shipped to every client page
- src/app/layout.tsx:21,34: `getMessages()` -> `NextIntlClientProvider messages={messages}` = ~31 KB en / ~41 KB ar JSON (uncompressed) on login and every page. Fix: pass `pick(messages, [namespaces needed by client components])` or move provider per route group (login gets none). Cost S-M. Accept: login page HTML/RSC payload drops by >30KB.

### P2-4 Bulk ZR push runs sequentially inside one server action (up to 200)
- orders/actions.ts:123-135, bulkTransition :234-250 loops RPC per id. Vercel function time limit will kill >~30 pushes and leave partial state with no report (`sent` computed from orderIds.length). Fix: cap at ~25 per call from UI (chunk client-side with progress) or use ZR bulk endpoint (already noted in ponytail comment); bulkTransition -> single RPC taking uuid[]. Cost M. Accept: 100-order push completes via chunked calls, failures listed.

### P2-5 Order-source webhook returns 200 even when processing failed
- src/lib/webhook.ts:318-319 returns `200 {ok:false}` on applyMappedOrder error, so Shopify/Lightfunnels never retry; order is lost until an admin notices the replay list. Fix: return 500 when `!result.ok` (idempotent via unique(workspace_id,source,external_id)). Cost S.

### P2-6 Dashboard client bundle: d3-geo + delaunay + map loaded eagerly
- src/app/app/dashboard/wilaya-section.tsx:13 static import of components/dashboard/algeria-map.tsx (only users of d3). Fix: `next/dynamic(() => import(...), {ssr:false})` or lazy mount when scrolled; saves ~25-30 KB gz from the dashboard route only. Cost S. dashboard/page.tsx is 751 lines/13 queries: fine as RSC, but split Promise.all already? (verify no serial awaits).

### P2-7 Orphan/partial writes in inviteUser
- settings/users/actions.ts:40-58: auth user is created, then profile update may fail -> orphan invited user with inactive profile and no retry path. Fix: on profileError call `admin.auth.admin.deleteUser`. Cost S.

## P3
- P3-1 product_stats view (00006) exposes `revenue_dzd` to delivery agents via direct REST (aggregate of orders they already see, so no new data, but violates "money only for admins" convention). Fix: drop revenue/expenses/ad/sourcing columns from the agent path (move to admin-only RPC) or revoke select on the view from authenticated and use pnl_by_product. Cost S.
- P3-2 updateOrderStatus (orders/actions.ts:38-60) and updateConfirmationStatus/updateDeliveryStatus (:191, :281) take unvalidated `orderId`/`status` (cast `as`). DB enum/uuid cast rejects, but CLAUDE.md says zod everything. Use `z.string().uuid()` + existing enums (CONFIRMATION_STATUSES). Cost XS.
- P3-3 Admin-only pages rely on layout guard (admin-guard-layout.tsx) + `(await getProfile())!` in pages (e.g. finance/overview/page.tsx:36). Layouts don't re-run on client-side child navigation in Next 16; RLS makes this cosmetic, but pages should call requireAdmin() themselves (cheap once getProfile is cached, P1-3).
- P3-4 Google Fonts via render-blocking `<link>` in layout.tsx:27-29 (no preconnect, third-party request, GDPR/offline). Use `next/font/google` (self-hosted). Cost S.
- P3-5 proxy runs `getUser()` on API/webhook paths (proxy.ts matcher) -> one extra Auth call per webhook; exclude `/api/webhooks` from matcher. Cost XS.
- P3-6 auth/callback/route.ts:18-19 ignores `exchangeCodeForSession` error and redirects to /app anyway (-> proxy bounce to /login, no message). Handle error -> /login?error=. Cost XS.
- P3-7 No retention on webhook_events / audit_log (payload jsonb with customer PII, audit_log stores full old/new rows). Add pg_cron prune (90d webhook payloads; null PII after processing). Cost S.
- P3-8 Repo hygiene: untracked-vs-tracked large files in repo root (BENZ Pricing xlsx, kimi zip, screenshots, kimi.tx) — confirm not tracked (`git ls-files` showed none matching, ok) and add to .gitignore.

## Suggested order
1) P1-1 + P1-2 (security/integrity, one migration + webhook patch, ~half day). 2) P1-3 (biggest latency win, small). 3) P2-1/P2-2 single migration. 4) P1-4 per page as volume dictates (contacts and cash/overview first). 5) rest opportunistic.
