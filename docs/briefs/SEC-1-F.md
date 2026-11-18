# SEC-1-F — audit redaction follow-up (D40, SEC-1 review-4)
risk: high · surface: ui,security · lane: shell

## Goal
Acronym-led and odd-case secret names are masked in SQL and TS alike, and the audit table reads correctly in AR and EN.

## Definition of done
- `XAPIKey`, `APISecret`, `ZRToken`, `IDKey`, `sEcReT`, `token_`, `"x_api_key "` are masked by `audit_redact` and `auditRedact`, with identical output.
- Allow-list unchanged: `key`, `idempotency_key`, `color_token` stay visible.
- Each change in the audit table is its own row; no inline `"; "`; correct in RTL.
- SQL/TS fingerprint claim in DB.md is true (string values) and tested by a shared case table.
- Gate green; no secret in audit_log after the 00036 backfill (local).

## Facts (real code)
- Latest migration 00035; next is 00036 (do NOT edit 00035). Both normalisers are `([a-z0-9])([A-Z])` -> `\1_\2` then `[-. :]` -> `_`, lowercase (00035:24,28; `src/lib/audit-redact.ts:10`).
- `diff.ts` `show()` turns any literal `[redacted:xxxxxxxx]` into a badge (review-3 #5).
- `audit-table.tsx:40-44` puts `"; "` inside `<bdi dir=ltr inline-block>`.
- SQL fingerprints `v::text` for non-strings; TS uses `JSON.stringify` (differs).

## Files and changes
1. `supabase/migrations/00036_audit_redact_acronyms.sql`: `create or replace audit_redact` = 00035 body with a shared normaliser: first `regexp_replace(k,'([A-Z]+)([A-Z][a-z])','\1_\2','g')`, then the existing split, then separators -> `_`, then `btrim(.., '_')` (trim spaces before replacing). Add a depth param/cap (e.g. 64) that masks the deeper subtree (review-4 #4). Keep revoke execute. Backfill: changed-rows-only `where ... is distinct from`. Fingerprint non-strings as `v::text` (jsonb canonical text).
2. `src/lib/audit-redact.ts`: same normaliser order, same depth cap; non-string fingerprint hashes a canonical form that equals jsonb text (sorted keys by jsonb order: length then bytewise; spacing `": "` and `", "`). If that is too costly, narrow the parity claim to strings and say so in DB.md.
3. `_lib/diff.ts`: show the badge only if the key is secret-named or the raw (pre-redact) value was masked by `auditRedact`; a user value that merely looks like a badge renders as text. Localise the pill via a `redacted` flag + fingerprint (UI composes text with `t("audit.redactedPill")`, hex in `<bdi dir=ltr>`). Add key to en.json + ar.json.
4. `audit-table.tsx`: render changes as `<ul>` of `<li class="text-start">`, each `dir=ltr` with key, from -> to; `role="note"` on the redacted span (keep tabIndex + aria-label).
5. `docs/DB.md`: update `audit_redact` row (acronym rule, depth cap, 00036).

## Steps (commit each)
1. 00036 + SQL test cases; 2. TS normaliser + parity test; 3. diff.ts + table UI + messages; 4. screenshots + PROGRESS note.

## Acceptance tests
- `audit-redact.test.ts`: names above (TS); allow-list kept; depth cap.
- `audit-redact.rls.test.ts` (live): shared case table through `rpc`-less service call to `audit_redact` and `auditRedact`, outputs equal incl. fingerprints; old_row masked on UPDATE and DELETE; ZR save path `config={tenant_id,api_key}` leaves no trace; backfill statement scrubs an inserted raw row, others untouched; agent session denied execute; check `error` on the settings insert.
- `_lib/diff.test.ts`: secret-only change gives two fingerprints; unchanged -> no entry; missing key -> `∅`; masked DB value -> `redacted: true`; fake badge in `name` stays text; output never contains `whsec_`/`sk_`.

## Screenshots (dark + light, EN + AR, plus 390 px)
`/app/settings/audit` filtered on `integration_configs`: separate change rows, pill readable, RTL alignment. Save to `docs/design/audit/`, incl. light AR and 390 px (missing today).

## Edge cases / out of scope
- Over-masking `*_key` names is intended (D49). Review-4 #7 (former-user label) is out of scope. Value-prefix net widening (review-3 #4) stays a later low.
- No new DECISIONS row needed: D49 rule is unchanged, only its normalisation is completed.
