# Council E: integrations, migrations, launch, Meta (read-only audit, 2026-10-21)

## ZR Express
- Client: src/lib/integrations/zrexpress.ts (BASE_URL hardcoded https://api.zrexpress.app/api/v1, no env override, no sandbox/dry-run). Push: zrexpress-push.ts pushToZR(). Creds in integration_configs (provider=zrexpress, config.tenant_id/api_key, secret=Svix secret).
- NOT testable without real parcels today: createZRParcel always POSTs /parcels. Fix = make BASE_URL env-overridable (ZR_API_BASE) and point at a local mock; or vitest mock global fetch. No test covers createZRParcel/pushToZR (only signature test zrexpress-webhook.test.ts).
- Double-push guard: pre-check zr_shipments + zr_shipments PK(order_id) + 00024 FOR UPDATE changed-flag. Gap: ZR call happens before the insert; if insert fails after parcel creation, parcel is orphaned and a retry creates a duplicate (externalId=order.id is sent but never checked/looked up).
- Inbound ZR webhook: Svix HMAC, 5-min tolerance, multi-sig, dedupe by svix-id, early 401 for junk. Dedupe is select-then-insert (no unique index) = tiny race, harmless (state update idempotent).
## Order webhooks (shopify, lightfunnel)
- Routes: src/app/api/webhooks/{shopify,lightfunnel,zrexpress}/route.ts. Auth: HMAC-SHA256 over raw body, constant-time, workspace resolved by whichever active secret verifies. Size cap 256KB. Every event stored (unauth callers get metadata-only row).
- Idempotency: unique(workspace_id, source, external_id) (00004) + select-then-insert/update; redelivery only updates logistics fields. Race: two concurrent first deliveries -> one insert fails on unique -> event marked error (data safe, response still 200 so no retry).
- Weaknesses: no timestamp/replay window on Shopify/LF (HMAC only); webhook_events grows unbounded for rejected junk (each bad POST = 1 row, DB write amplification); LF header name "x-lightfunnel-signature" and payload field names are guesses, never verified against a real LF payload; always 200 on mapping failure (no provider retry; use admin replay). Shopify only: no X-Shopify-Webhook-Id dedupe (covered by external_id).
## Lightfunnels references (files)
Code: src/lib/webhook.ts (lightfunnelProvider, replayEvent), src/app/api/webhooks/lightfunnel/route.ts, src/app/app/settings/{actions.ts,integrations-section.tsx,zrexpress-section.tsx(comment)}, src/lib/enums.ts (ORDER_SOURCES), src/lib/statuses.ts, src/app/app/orders/all/orders-all-table.tsx, src/lib/supabase/database.types.ts (generated enum), src/messages/{en,ar}.json, scripts/seed-dev.ts.
DB: enums order_source/integration_provider (00001/00002), 00012. Docs: SPEC, DB.md, SETUP, phases 02/06, PROGRESS, DESIGN_SYSTEM, UI_AUDIT, status-system ref, OPUS_*_PROMPT.
Removal impact: Postgres can't drop enum values easily; do NOT remove the enum value (orders.source='lightfunnels' history + seeds + webhook_events). Safe removal = delete route, provider, settings card/zod enum/i18n, keep enum + source color mapping for historical rows (replayEvent falls back to LF for any non-shopify provider: fix). Existing LF orders remain intact. Cheapest launch choice: leave it (inert unless configured; unconfigured -> 401 "secret not configured").
## Env vars (names only)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server only), APP_URL (used for ZR webhook callback registration; must be https prod URL). Test-only: LOCAL_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY. NODE_ENV. Per-workspace secrets (ZR tenant/key, Shopify/LF HMAC) are DB rows set in Settings, not env. Future Meta: META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN (or encrypted in integration_configs), CRON_SECRET.
.env.local.example lists only the two NEXT_PUBLIC vars (incomplete). .env.local is gitignored. kimi.tx still exists on disk untracked (83 bytes; delete + rotate key).
## Vercel / SETUP.md
- No vercel.json, no .vercel dir, no .github CI, no cron. next.config.ts has security headers (no CSP). Build gate is npm run build. Webhook routes runtime nodejs. Default Vercel fn timeout fine; bulk ZR push is sequential (could time out on big batches: set maxDuration).
- SETUP.md is STALE: refers to 00001_init.sql, bootstrap_admin only, 2 env vars, old layout. Needs rewrite (migrations db push, 4 env vars, bootstrap workspace/admin, webhook URLs, ZR setup, Google OAuth, Vercel).
## Migrations 00020-00024 (all additive, non-destructive, no data rewrite)
- 00020: create or replace view agent_performance (appends 2 cols) + new view workspace_performance, security_invoker. Safe. Needs 00006 views + history table.
- 00021: SECURITY. account_balances -> security_invoker + revoke anon (CRITICAL fix: anon could read finances); guard_profiles replaced (blocks cross-tenant self-move); revoke execute on seed_workspace/bootstrap_workspace from public/anon/authenticated. CAUTION: if bootstrap_workspace/seed is invoked via a normal authenticated client in app or SETUP flow it will now fail; run via service role/SQL editor. Apply FIRST of the security-relevant set; should not be skipped even if rest delayed.
- 00022: create or replace pnl_lines, pnl_summary, pnl_by_product (new), dashboard_stats (replaced; same signature as 00011 -> create or replace OK). Changes all money numbers on dashboard (intended). Rollback = re-run 00011 body of dashboard_stats; drop pnl_*. Depends on 00017 accounts? (ad_spend, cash_collections, settings.return_fee exist). Needs types regen.
- 00023: add column products.low_stock_threshold int not null default 5. Fast on PG11+ (constant default). Needs types regen.
- 00024: DROP FUNCTION transition_order_status then CREATE returning boolean (was void). Destructive to function only; re-grants done in file. Brief window with no function if not in a transaction (supabase wraps each migration in one). ORDER MATTERS WITH APP DEPLOY: push 00024 BEFORE deploying new code (new code on old DB: rpc returns null -> auto-push to ZR silently never fires; old code on new DB works).
- Order: 20,21,22,23,24 sequentially; all independent except dependence on earlier migrations; deploy app after 24. Not run (per instruction). Memory note: remote reset is blocked, so only `db push` of pending migrations; take a pre-push backup (Supabase dashboard backup/PITR) first.
## Meta Marketing API (secondary sources; verify on developers.facebook.com)
Sources found: admanage.ai, adlibrary.com, adstellar.ai, adamigo.ai, goodmorningco.com blog posts (no official docs fetched).
- Auth: Meta app (Business type) + Business Manager; create a System User, assign ad accounts, generate token with ads_read (read_insights sometimes cited; ads_read suffices for Insights). Sources conflict: system user tokens either non-expiring or 60-day; build for token-expiry alerting either way. Long-lived user tokens ~60d; short ~1h.
- Access: Own-ad-accounts use needs only Standard/"Limited" access to ads_read; no app review for your own business's accounts in dev mode when app admins/system user own them. Advanced/"Full" access (higher rate limits, other people's accounts) needs App Review + Business Verification; (as of May 2026 renames) upgrade requires >=500 calls in 15 days with <15% errors. Single-owner SaaS-lite: stay on Limited, no review. If it becomes multi-tenant SaaS (each customer connects own account via OAuth) -> app review + business verification required.
- Endpoint: GET /v{N}/act_<AD_ACCOUNT_ID>/insights?level=campaign&fields=campaign_id,campaign_name,spend,account_currency,date_start&time_increment=1&time_range={since,until} (+ filtering, paging cursors). Use async report runs (POST insights -> report_run_id) for big ranges.
- Rate limits: points/BUC based (read=1 pt reported by one source); watch X-Business-Use-Case-Usage / X-Ad-Account-Usage headers, back off >80%, error codes 17/32/613/80000-80004. Daily sync of N campaigns is far below limits.
- Spend semantic: Meta returns spend in ad-account currency (often USD/EUR) per day in the ACCOUNT timezone; maps to ad_spend_daily (amount, currency, fx_rate) -> must pull rate from exchange_rates.
### Architecture
Scheduled job (Vercel Cron -> /api/cron/meta-spend, CRON_SECRET bearer; or Supabase pg_cron) -> admin client -> for each workspace integration_configs(provider='meta') read token/ad account -> insights daily, last 3 days rolling (restatements) -> upsert.
Data gap: ad_spend_daily is keyed (workspace, product_id, spent_on, kind) NOT NULL product. Need new table meta_campaign_map(campaign_id -> product_id, kind test/scaling) and/or raw table meta_spend_daily(campaign_id, date, spend, currency) then derive ad_spend_daily rows with source='meta' column (so manual entries aren't overwritten; unique key conflict with manual rows on same product/day/kind needs a source dimension or summing). Needs new enum value integration_provider 'meta' (migration) and admin-only RLS. Unmapped campaigns -> "unassigned" surfaced in UI.
### Blockers the OWNER must provide
1. Meta Business Manager admin access + ad account ID(s). 2. Create/own a Meta developer app (app id/secret) and a System User with ads_read on those ad accounts; token generated by owner (Business Settings > System Users). 3. Decide per-campaign -> product mapping convention (e.g. campaign name prefix/SKU). 4. Ad account currency + whether to use daily fx. 5. If multi-tenant/OAuth: business verification docs + privacy policy URL + app review video. 6. Confirm Algeria-based business can complete Business Verification (documents) if ever needed. Without these, build and test against a mocked Graph API only.

## Integration test strategy
1. Unit: HMAC verify (shopify base64, LF hex, Svix) exist; add pushToZR with injected fetch mock asserting body (stopdesk hub, phone +213, amount), error mapping.
2. ZR sandbox safety: add env ZR_API_BASE (default prod) -> point to local mock server (msw/node http) returning {id}; guard: refuse prod base when APP_URL is localhost or NODE_ENV!=production. Never push with real creds in tests; confirm ZR offers a test tenant (ask ZR).
3. Webhook e2e on local Supabase: signed payloads (script like TEST_PAYLOAD_BUILDERS in settings/actions.ts) posted twice -> exactly 1 order; bad sig -> 401, row has no body; wrong-workspace secret; oversized -> 413; concurrent double-post.
4. ZR inbound: Svix-signed state event -> shipment state + delivery_status via zr_state_map; stale timestamp -> 401, 0 rows; replay svix-id -> duplicate.
5. Race: 3 concurrent confirms -> one push (already proven [true,false,false]).
6. RLS tests (40 skipped) run against local docker before launch. Meta: Graph mock fixtures, idempotent upsert test.

## Ordered launch checklist
1. Rotate kimi key, delete kimi.tx and the backup bundle (~/mnw-erp-backup-*.bundle). Confirm git history clean (git log --all -- kimi.tx).
2. Run RLS tests on local stack; npm test, tsc, npm run build green.
3. Supabase remote: backup/PITR snapshot -> db push 00020..00024 (user runs) -> regen types, confirm no diff.
4. Create Vercel project, set env vars (4), APP_URL=prod https URL; Supabase Auth site URL + redirect URLs, Google OAuth credentials if enabled (14h pending).
5. Deploy `mnw` to Vercel (after migrations). Push branch (re-set upstream).
6. Bootstrap workspace + admin via SQL editor (service role; 00021 revoked client exec).
7. Settings: Shopify/LF secret + store webhook URLs https://<app>/api/webhooks/{shopify,lightfunnel}; send test order via Settings test button; verify one order, resend -> still one.
8. ZR: tenant id + API key, sync territories, register webhook endpoint (uses APP_URL), set zr_state_map; first push of ONE real controlled order with ZR agreement (cancel in ZR after).
9. Smoke both themes/locales, agent role cannot see money; monitor webhook_events errors for 48h.
10. Rewrite SETUP.md; add Vercel cron only if Meta later.

## Config checklist
Env x4 on Vercel (prod+preview separated; preview must point at a non-prod Supabase or have webhooks off). Supabase: site URL, redirect URLs, SMTP for invites, Google provider. Integrations: per-workspace secrets rows is_active=true. Fees (wilaya_fees), settings return_fee, zr_state_map, products low_stock_threshold. Optional: maxDuration on bulk ZR route, CSP.

## Rollback plan
- App: Vercel instant rollback to previous deployment (safe against new DB, except 00024 mismatch only affects old code reading rpc result = fine).
- DB: migrations additive; reverting = forward-fix SQL: restore dashboard_stats from 00011; drop pnl_* functions; drop column low_stock_threshold; restore transition_order_status void body (00015); 00021 must NOT be rolled back. For real data damage: PITR restore from pre-push backup. Don't use db reset --linked.
- Integrations: deactivate (is_active=false) integration_configs row stops webhook processing; cancel erroneous ZR parcels in ZR dashboard; webhook_events enable replay.
