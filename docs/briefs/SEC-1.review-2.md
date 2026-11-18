VERDICT: FIX

## Summary
Review-1 is mostly resolved. Non-string, settings {key,value}, over-matching, browser crypto, bidi, seed secret, `stable` + revoked execute, light chip and server-side redaction are all fixed. Both SEC-1 test files pass live (qa-reviewer).
Two medium gaps remain. The key regex is an exact-name list that fails open: `meta_access_token`, `telegram_bot_token`, `x-api-key`, camelCase and similar names are stored in clear. The backfill WHERE clause skips multi-segment settings names, so old rows stay plaintext.
UI was not verified live, because the reviewer's session expired. AR light and 390 px screenshots are still missing.

## Findings (ranked)

1. **MEDIUM. Key regex fails open.** `supabase/migrations/00033_audit_redact.sql:13`, `src/lib/audit-redact.ts:7`
   - Failure, run on the live DB: `audit_redact('{"secret_token":"x","meta_access_token":"EAAB1","capi_token":"y","telegram_bot_token":"1:AA","zr_api_key":"z","x-api-key":"k","apiSecret":"a","accessToken":"t","clientSecret":"c","credentials":{"pass":"p"}}')` returns every value unchanged.
   - These are the names the planned TRACK and NOTIF features put in `integration_configs` (TRACK.md:13, NOTIF.md:36/43). That breaks the done criterion "any table, any trigger". The backfill uses the same function, so it would not catch them later either.
   - Fix (fail closed):
     - Normalise each key: camelCase to snake_case, `-` to `_`, lowercase.
     - Mask when any `_` segment is in {secret(s), token(s), password, passwd, pwd, apikey, credential(s), authorization, signature}, or when the key contains api_key, access_key or private_key.
     - Keep a small allowlist of safe names: `color_token`, `token_count`, `*_token_id`.
     - Make the same change in SQL and TS.

2. **MEDIUM. Backfill filter misses multi-segment settings names.** `supabase/migrations/00033_audit_redact.sql:73-74`
   - Failure: `"[a-z]+[_-](token|secret|key)"` cannot match `"telegram_bot_token"` or `"tracking_api_token"`, because `[a-z]+` stops at the first `_`. In settings `{key, value}` rows the name is a string value, not a JSON key, and no other alternative matches it. Those old rows are never passed to `audit_redact` and keep their plaintext value. This breaks the done criterion "Existing audit_log rows are scrubbed".
   - Fix: drop the WHERE clause (the redactor is idempotent and precise), or use a loose unanchored `~* '(secret|token|password|passwd|api[_-]?key|authorization|signature|credential)'`.

3. **LOW. User text can fake the badge.** `src/app/app/settings/audit/_lib/diff.ts:7,12`
   - Failure: a user-entered value that is exactly `[redacted:abcdef12]` (an option label or an expense note) renders as a redaction badge.
   - Fix: carry `redacted` as structured data from the redaction step itself, not by matching the string.

4. **LOW. Value-prefix rule is narrow.** `00033:38`, `audit-redact.ts:10`
   - Failure: these are not masked: `bearer x`, `Bearer\tx`, values with leading whitespace, Telegram bot tokens (`^\d+:[A-Za-z0-9_-]{30,}$`) and Meta `EAA…` tokens.
   - Fix: match case-insensitively, trim before matching, and add the two token patterns with a length bound.

5. **LOW. TS/SQL fingerprint mismatch for non-string secrets.** `audit-redact.ts:26`
   - Failure: TS hashes `JSON.stringify(v)` and SQL hashes `v::text`, which has different spacing, so the same object gets two fingerprints. This only affects rows that were never scrubbed.
   - Fix: hash a canonical form, or document that the two differ.

6. **LOW. Accessibility and evidence.** `audit-table.tsx:22`
   - Failure: `aria-label` sits on a span with no role, and many screen readers ignore it. The AR light and 390 px screenshots the brief asks for are missing. UI was not re-verified live: focus ring, contrast of `text-muted-foreground` at text-xs in light, RTL diff row.
   - Fix: give the span `role="img"`, or use visible or sr-only text. Take the missing screenshots.

7. **LOW. Cosmetic.** `src/messages/{en,ar}.json:955`: the `audit` namespace is a one-line object. Key parity holds.

## Missing tests
- Positive fixtures in both SQL and TS:
  - `secret_token`, `meta_access_token`, `capi_token`, `telegram_bot_token`, `zr_api_key`, `x-api-key`
  - camelCase `accessToken`, `clientSecret`
  - nested `credentials`
  - negatives: `color_token`, `tracking_token_id`
- One fixture table run through both `auditRedact()` and the `audit_redact` RPC, with outputs compared. Today only one fixture is compared.
- Live tests for:
  - DELETE: `old_row` is masked.
  - ZR save: `config.api_key` is absent from `audit_log`.
  - A `settings` row with key `*_bot_token`: its value is masked.
- A backfill test: a raw settings row with a multi-segment `*_token` name is scrubbed by the migration's UPDATE.
- `diffRows`: a user-entered `[redacted:xxxxxxxx]` value does not render as a badge.
