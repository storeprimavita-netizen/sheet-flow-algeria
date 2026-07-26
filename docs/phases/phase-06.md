# Phase 6 — Webhooks v2 (Shopify + LightFunnels)

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §3 (Webhooks) + §Deviations
(they stay Next.js route handlers), docs/DB.md (webhook_events,
integration_configs, orders idempotency). Reuse `src/lib/webhook.ts` heavily.

## Goal

Re-point the existing webhook pipeline at the v2 schema with raw-event
storage, customer upsert, delivery-fee fallback, and health tracking.

## Pipeline (per provider route in `src/app/api/webhooks/{shopify,lightfunnel}/route.ts`)

1. Read raw body; load `integration_configs` row for the provider via the
   service-role client (single workspace for now: the only workspace row —
   write a `resolveWorkspace()` helper so multi-tenant routing (per-domain)
   is one function later).
2. Verify HMAC (existing `verifySignature`, hex for LightFunnels, base64 for
   Shopify). **Always** insert a `webhook_events` row (payload, signature_ok,
   error) — invalid signatures get stored + 401, not silently dropped.
3. Map payload → unified shape (existing mappers; extend with: wilaya
   (map name → code, fuzzy fallback null), commune, delivery fee from
   payload, delivery_type, variant).
4. Upsert order on `(workspace_id, source, external_id)` — re-deliveries
   must NOT clobber workflow state (v1 rule: only logistics fields update).
   Set `webhook_event_id`, `delivery_fee_source='payload'` or fallback to
   `wilaya_fees` lookup (`'wilaya_table'`).
5. `upsertCustomerFromOrder()` (Phase 5 lib) with the service client.
6. Mark event `processed_at`; update `integration_configs.last_event_at`.
   On mapping errors: store `error` on the event, return 200 (don't make
   platforms retry forever), leave order untouched.

## Also

- Settings → Integrations page: show `last_event_at` health + a "recent
  events" list (webhook_events, admin) with payload viewer + a **replay**
  button (re-runs the mapping for one event — this is why we store raw).
- zod-validate mapped output before writing.

## Acceptance criteria

- `curl` fixture tests for both providers (valid sig, bad sig, duplicate
  delivery, unknown wilaya): correct order rows, single order on redelivery,
  events stored with correct flags. Document the curl commands in the PR/
  PROGRESS notes.
- Duplicate-detection trigger fires for webhook orders too (same phone +
  product <48 h).
- Confirmed workflow state survives a webhook redelivery.
- `npm run build` green.
