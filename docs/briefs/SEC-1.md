# SEC-1 — redact secrets in the audit log
risk: high · surface: ui,security · lane: shell

## Goal
No integration secret (`integration_configs.secret`, `whsec_…`, api keys, tokens) is ever stored in or shown from `audit_log`; a short fingerprint shows that it changed.

## Definition of done
- Newly written `audit_log.old_row/new_row` never contain a secret-looking value (any table, any trigger).
- Existing `audit_log` rows are scrubbed by the migration (backfill).
- `/app/settings/audit` shows `[redacted · ab12cd34]` for such keys and a changed-fingerprint diff when only the secret changed.
- Webhook verification and integration save keep working (they read `integration_configs` directly, untouched).
- Test: seeded secret is absent from `audit_log` and from the page's rows; gate green.

## Facts found (code, not plan)
- `audit_row()` in 00001_core.sql:169 does `to_jsonb(old/new)` raw; attached to integration_configs (00002:139), zr_shipments, accounts, products, option sets, cash.
- `integration_configs.secret` is plaintext (ZR api key too, 00012 header); `config` jsonb holds ids/domains (may hold keys later).
- Page `settings/audit/page.tsx` `diffRows` prints raw from/to; DB is the wall, UI is second layer.
- Next migration number: 00033. No audit_log write policy exists (RLS test already asserts), migration runs as owner.

## Files
1. `supabase/migrations/00033_audit_redact.sql`
   - `public.audit_redact(j jsonb) returns jsonb` immutable: recursively (objects, arrays) for keys matching `(secret|token|password|passwd|api[_-]?key|apikey|authorization|signature)` (case-insens.) OR string values matching `^(whsec_|sk_|shpss_|shpat_|Bearer )` replace with `'[redacted:' || left(encode(sha256(convert_to(v,'utf8')),'hex'),8) || ']'`. Null/empty stays as is. Built-in `sha256` (PG11+), no pgcrypto.
   - `create or replace function audit_row()` same body, wrapping old/new in `audit_redact(...)`; keep security definer + `set search_path = public`.
   - Backfill: `update public.audit_log set old_row = audit_redact(old_row), new_row = audit_redact(new_row) where old_row::text ~* '...' or new_row::text ~* '...'` (scrub only; deleting data is not done).
   - Checklist: no new table, so RLS/triggers unchanged; add `audit_redact` + redaction rule to docs/DB.md; regen types not needed (no schema change to tables).
2. `src/lib/audit-redact.ts` (+ same key regex) used by `diffRows` as second layer for rows written before backfill or by other paths; pure function.
3. `src/app/app/settings/audit/page.tsx` / `audit-table.tsx`: render redacted values with a muted mono style, no new strings except a tooltip key `audit.redacted` in en.json + ar.json (parity).

## Steps (each commit+push)
1. Migration + DB.md.
2. `audit-redact.ts` + unit test; wire into page.
3. Live test (below) + PROGRESS note + screenshots.

## Acceptance tests
- `src/lib/audit-redact.test.ts`: key match, nested, array, `whsec_` value under an innocent key, fingerprint stable and differs for two secrets, null stays null.
- `src/lib/rls.test.ts` (or new `audit-redact.rls.test.ts`, live): admin updates `integration_configs.secret = 'whsec_TESTSEED…'` via session client; service-role read of newest audit_log row has no `whsec_TESTSEED` anywhere (`JSON.stringify`), has `[redacted:` ; secret column itself still holds the real value; cleanup builds and removes its own workspace data (as TEST-1).
- Backfill: insert a raw secret row with service role before migration is not testable in-suite; verify manually via `supabase db reset` + one `select ... where new_row::text ilike '%whsec_%'` = 0.

## Screenshots (both themes, EN + AR)
`/app/settings/audit` filtered on `integration_configs`: redacted value pill readable, diff row, RTL alignment.

## Edge cases
- Over-redaction: keys like `token_count` / `signature` columns elsewhere get masked; acceptable (display only, row data intact). Tracking tokens (future) are also masked, which is desired.
- Secret unchanged on update: both fingerprints equal, so diff hides it (good); changed: fingerprints differ.
- A short fingerprint (8 hex of sha256) of a low-entropy secret is brute-forceable; secrets here are high-entropy. Accepted.
- Webhook_events payloads are out of scope (not in audit_log).

## Decisions
None needed. Rest of the plan (encrypting `integration_configs.secret` at rest) is a separate follow-up, not SEC-1.
