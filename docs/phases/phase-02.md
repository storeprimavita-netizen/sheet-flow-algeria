# Phase 2 — Settings section (complete)

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §9, docs/DB.md
(§settings keys, wilaya_fees, fixed_fees, exchange_rates, integration_configs).

## Goal

Build the full admin Settings section. This unblocks everything downstream
(fees, FX, thresholds, integrations).

## Pages (all admin-only, under /app/settings)

1. **Workspace** — rename workspace.
2. **Integrations** — per provider (shopify, lightfunnels): store
   domain/config, secret set/replace (never echo existing secret to the
   client — v1 settings page already did this right, reuse the pattern),
   webhook URL to copy, `last_event_at` health badge.
3. **Delivery fees** — editable 58-row grid (home fee / stopdesk fee /
   manual stop-shipping toggle) over `wilaya_fees`. Bulk-edit friendly
   (inline inputs + single save).
4. **Fixed fees** — CRUD `fixed_fees` (label, amount, currency → show
   converted DZD using current rate at entry, store `fx_rate`).
5. **Exchange rates** — append-only entries (currency, rate, valid_from) +
   current-rate summary cards.
6. **Thresholds** — forms writing `settings` keys: `return_fee`,
   `duplicate_window`, `risk_weights`, `stop_shipping_rule`,
   `meeting_schedule`.

## Steps

- Server components + server actions; zod-validate every form.
- Shared `getSetting(ws, key)` / `setSetting()` helpers in
  `src/lib/settings.ts` (replaces the deleted v1 `app-settings.ts`).
- `integration_configs` replaces v1 `app_settings` keys; webhook route
  handlers will read it in Phase 6 — just store correctly for now.
- Verify the audit triggers: every save appears in `audit_log` (no UI yet;
  check via SQL).

## Acceptance criteria

- All six subsections functional; values persist and re-render.
- Agent role cannot load /app/settings (redirect) nor read the tables (RLS).
- Every settings mutation lands one row in `audit_log`.
- `npm run build` green.
