# ZR-2 ZR status sync (stale guard) + drop delivery_agent from invite UI + hide agent actions on shipped
risk: high   (webhook + ZR + migration + order status/stock triggers)
Deps met: ZR-1 done (audit §8 probe), P0-4 done locally (00025, rls tests). Next migration = 00027.

## Confirmed in code
- zrexpress-webhook.ts: reads `payload.type`, but ZR envelope is `{eventType, occurredAt, data}` (audit §3) -> accept both (`eventType ?? type`); today events may be silently ignored. Writes `state_updated_at=now()` and orders.delivery_status unconditionally (audit §8 bug).
- refreshZRShipmentStatus (orders/actions.ts:142) also stamps now() and never updates orders -> defeats any guard; must use the same apply path.
- Webhook registered with eventTypes ["parcel.state.updated"] only (zrexpress.ts:220). State matched by NAME via settings.zr_state_map (user-edited, default {}); slug field name unknown (probe printed undefined) -> store name, slug nullable.
- No cron infra (no vercel.json, only /api/webhooks). delivery_status enum has no collected state: livre/encaisse/recouvert -> delivered, recupere_par_fournisseur -> returned (via map; D14 cash is ZR-4, not here).
- 00025 already blocks agents on shipped orders at DB level; UI just still shows the buttons.

## Changes
1. `supabase/migrations/00027_zr_state_sync.sql`: `alter table zr_shipments add state_slug text, occurred_at timestamptz, situation text, is_return boolean`. Function `apply_zr_state(p_ws uuid, p_parcel uuid, p_state text, p_slug text, p_situation text, p_is_return bool, p_occurred timestamptz) returns uuid` security definer, `revoke all from public/authenticated; grant execute to service_role`: single `UPDATE zr_shipments SET ... WHERE workspace_id=p_ws AND parcel_id=p_parcel AND (occurred_at IS NULL OR occurred_at <= p_occurred) RETURNING order_id` (atomic; equal timestamp = idempotent re-apply). Null result => stale/unknown, no order write. Keep state_updated_at = p_occurred.
2. `zrexpress-webhook.ts`: schema adds eventType/occurredAt (ISO, required else 400)/data.{state{name,slug?},situation{slug?},isReturn,lastStateUpdateAt}. Handle parcel.state.updated, parcel.state.situation.created (situation only), parcel.isReturn.updated. occurredAt = payload.occurredAt (fallback data.lastStateUpdateAt). Call RPC; only if order_id returned and state mapped, update orders (existing `.neq` no-op). Extract the apply+map logic into one exported `applyZRParcelState(supabase, ws, parcel)` reused by catch-up and refresh.
3. `zrexpress.ts`: extend ZRParcel (+lastStateUpdateAt, situation, isReturn, state.slug); add `searchZRParcels(creds,{trackingNumbers|states,page})` (POST /parcels/search, sequential, 429 backoff); register also situation.created + isReturn.updated in createZRWebhookEndpoint (existing endpoints need admin re-register -> button in settings, note only).
4. `orders/actions.ts` refreshZRShipmentStatus: use applyZRParcelState with parcel.lastStateUpdateAt (admin client for RPC).
5. `src/app/api/cron/zr-sync/route.ts` + `vercel.json` cron (every 30 min): Bearer CRON_SECRET (constant-time compare, 401 else); per active zrexpress workspace, shipments with non-terminal state (not delivered/returned/recouvert/recupere), cap 100/run, sequential getZRParcel/search, applyZRParcelState. Mid-run error on one workspace must not stop others.
6. D9 UI: invite-form + RoleSelect: drop delivery_agent from selectable ROLES unless it is the row's current legacy role (user-row). users/actions.ts invite schema -> enum(admin, confirmation_agent); update schema keeps delivery_agent (legacy). Remove deliveryAgents picker from AssignmentCard/[id]/page.tsx and orders-all-table.tsx:276. Keep enum/column (D9). Messages en/ar: remove only unused strings.
7. Hide on shipped: confirmation-sheet `dial()` button + order-taxonomy-card cancel-reason hidden for non-admin when `zrShipment || delivery_status !== 'wait_for_deposit'` (pass `locked` prop from confirmation/page.tsx and [id]/page.tsx). Admin keeps both.
8. docs/DB.md: new columns + apply_zr_state; settings default hint for zr_state_map (recouvert/livre->delivered, recupere_par_fournisseur->returned) in zrexpress-section copy.

## Step order
migration -> local apply + regen types -> webhook/apply fn + tests -> refresh action -> cron route -> UI D9 -> hide-on-shipped -> `scripts/gate.sh`.

## Acceptance tests (named)
- `out-of-order event: older occurredAt after newer is ignored (shipment state + order unchanged)`
- `idempotent: same svix-id twice and same occurredAt twice leave one history row`
- `unmapped state stores shipment, leaves order untouched`
- `eventType envelope parsed; missing/invalid occurredAt -> 400`
- `apply_zr_state not callable by authenticated/anon (rls.test.ts)`
- `refreshZRShipmentStatus uses parcel timestamp, stale refresh no-op`
- `cron: 401 without secret; one workspace failure does not abort others`
- `invite rejects delivery_agent; legacy user row still renders`
- `confirmation agent: dial + cancel-reason hidden when shipped` (component/render check) ; existing 112 tests green.

## Edge cases
- Admin correction (orders.delivery_status edited by admin) is overwritten by the next NEWER ZR event; history shows actor null vs admin -> acceptable per D9, keep audit visible.
- Equal occurredAt but different state: applied ONLY for live reads (`apply_zr_state(..., p_live := true)`: Refresh and cron read ZR's current state); webhooks (p_live false) ignore ties since delivery order is not guaranteed. Same-state equal-timestamp replay (compared with lower(btrim())) is a no-op (admin correction survives Refresh/retry). Known debt P0-8: stock trigger does not undo a return when an order leaves returned. Parcel without lastStateUpdateAt: refresh/cron/apply error, never a silent ok. Cron visits workspaces in random order.
- Existing rows occurred_at NULL: first event always applies.
- Parcel state ZR-side regresses legitimately (returned -> redelivered): newer wins, status triggers handle stock.
- Rate limit unpublished: sequential, backoff on 429, cap per run.
- Legacy delivery_agent prod users unknown (P0-4 owner check) -> never delete role, only hide from invite.

## Assumptions
Confirmed: 00025 locks agents; map-by-name path. Stale: webhook `type` key (envelope is eventType); webhook only subscribed to state.updated. Unverified: state slug field, real occurredAt format (test with a captured payload), isReturn payload.
Owner (non-blocking): set CRON_SECRET in Vercel; re-register ZR webhook endpoint from Settings; fill zr_state_map.

## /verify FAIL overrides (authoritative; supersede Changes above where they conflict)
1. `apply_zr_state` does the zr_state_map lookup AND the orders.delivery_status update in the same txn under the shipment row lock (`select ... for update`); the order follows the shipment's STORED state, never the payload. Stock moves once (trigger fires only on real status change).
2. EXECUTE revoked from public/anon/authenticated, granted to service_role only; `set search_path = public`; rls.test.ts covers anon AND authenticated.
3. `webhook_events` unique (provider, workspace_id, external_id) where external_id not null; processed_at set only after apply succeeds; failed apply -> 500 and a same-svix-id retry re-applies.
4. State ordered by data.lastStateUpdateAt on every path (webhook, refresh, cron); situation/isReturn use `situation_at` and never touch state; null p_state never wipes state.
5. RPC raises on NULL p_occurred.
6. ISO timestamps with offsets accepted; invalid occurredAt falls back to lastStateUpdateAt before 400.
7. Cron: GET, 401 when CRON_SECRET unset/wrong (`src/lib/cron-auth.ts`).
8. Cron polls every parcel whose raw state is not recouvert / recupere_par_fournisseur (livre/encaisse still polled for ZR-4).
9. zr_state_map defaults seeded (livre/encaisse/recouvert -> delivered, recupere_par_fournisseur -> returned) without overwriting an owner map; RPC falls back to them only if no map row exists.
10. Unique (workspace_id, parcel_id) on zr_shipments.
Also: webhook accepts eventType and type; delivery_agent out of invite UI/assignment pickers (enum kept); attempt-log + cancel-reason hidden on shipped orders for non-admins.
Dropped: `searchZRParcels` (cron uses sequential getZRParcel; add when volume needs it). 429: one backoff retry in zrFetch.
