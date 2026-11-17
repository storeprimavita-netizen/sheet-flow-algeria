# TRACK — pixels and Conversions API (Meta, TikTok)

Goal: every store event reaches Meta/TikTok once (browser + server,
deduplicated), and the platforms also learn which orders were **confirmed,
delivered and returned**, so campaigns optimise for buyers who actually
receive. Needs the native store (STORE-4). Risk high: tokens and customer PII.

Facts marked *verify* came from vendor pages on 2026-11-17 — re-read the
official Meta / TikTok docs in the brief before building on them.

## Configuration (Store → Tracking, admin-only)

Per store: Meta pixel/dataset id + CAPI access token + test event code; TikTok
pixel id + Events API token. Tokens live in `integration_configs` (admin-only,
never sent to the browser, never logged). Settings: purchase trigger
(`submit` | `confirmed`), value to send (`order total` | `expected profit`),
which lifecycle events to send, on/off per platform.

## Event ids — one rule

`event_id = <order public id>:<event name>` for order events and
`<session id>:<event name>:<page id>` for browsing events. The browser pixel
and the server send the **same** `event_name` + `event_id`; Meta deduplicates
on that pair within 48 h. The thank-you page fires the browser event once per
order (guarded by the order id in storage), so a refresh cannot duplicate it.

## Events

| When | Meta | TikTok | Sent by |
|---|---|---|---|
| Product page viewed | ViewContent | ViewContent | browser + server |
| First form interaction | InitiateCheckout | InitiateCheckout | browser + server |
| Order submitted | Purchase (trigger=submit) or Lead (trigger=confirmed) | CompleteOrder / SubmitForm *verify* | browser + server |
| Order confirmed by phone | Purchase (trigger=confirmed) + custom `OrderConfirmed` | custom *verify* | server only |
| Order delivered | custom `OrderDelivered` | custom *verify* | server only |
| Order returned | custom `OrderReturned` | custom *verify* | server only |

Lifecycle events are stamped with the time of the status change, never
backdated to the order: Meta rejects a batch whose `event_time` is older than
7 days. An event that became older than 7 days before it could be sent is
dropped and recorded as `expired`. Custom conversions built on
`OrderDelivered` are created by the owner in Events Manager. Whether custom
events qualify for value optimisation is unconfirmed — do not promise it.

## Matching data (captured at order submit, stored for later events)

`order_tracking` (service-role only; admin read): order_id, fbp, fbc (from the
`_fbc` cookie or built from `fbclid`), ttclid, ttp, client IP, user agent,
event source URL, utm fields. Sent to Meta: `ph` = SHA-256 of digits with
country code and no leading zero (`0551234567` → `213551234567`), `country` =
hashed `dz`, `external_id` = hashed customer id, city/state when known;
`fbp`, `fbc`, `client_ip_address`, `client_user_agent` unhashed;
`action_source: website` for store events. TikTok: phone as SHA-256 of E.164
(`+213…`) *verify*, plus `ttclid` and `_ttp`.

## Delivery — an outbox, never inline

`tracking_events`: workspace, store, order_id, platform, event_name, event_id
(unique per platform), payload (hashed PII only), status
`pending|sent|failed|expired|skipped`, attempts, last_error, sent_at. The order
submit and status triggers only insert rows; a cron worker sends in batches
with retry and backoff. A platform outage never blocks an order. Admin screen:
recent events, match-quality hint (which identifiers were present), resend.

## Rules

- Dev and preview never send to real pixels: the sender is a no-op unless
  production and the store has tracking enabled; tests use recorded fixtures.
  Meta's test event code is the only way to try live, owner-initiated.
- Agents never see tokens, payloads or tracking tables.
- The privacy policy page states that hashed contact details are shared with
  ad platforms; abandoned-checkout capture is mentioned too.
- Returned orders are never sent as a negative Purchase.

## Tasks

TRACK-1 config + browser pixels + event ids · TRACK-2 `order_tracking`
capture + outbox + Meta sender (fixtures) · TRACK-3 lifecycle events from
status changes · TRACK-4 TikTok sender · TRACK-5 events screen + match hints.

## Acceptance

Same event sent twice → one outbox row · browser and server ids equal for the
same order · phone hashing vectors for 05/06/07, +213, 00213 · an 8-day-old
event → `expired`, not sent · no token or raw phone in any log line or
`tracking_events.payload`.
