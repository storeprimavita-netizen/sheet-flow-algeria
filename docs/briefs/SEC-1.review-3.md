VERDICT: ESCALATE

## Summary
Third diff review with no PASS, so this escalates under the loop rule (n ≥ 3). The core goal holds. On the local stack, `whsec_` and `api_key` values are masked in old_row and new_row, the fingerprint changes when the value changes, the backfill left 0 raw secrets, `audit_redact` can only be executed by postgres and service_role, and webhook and integration save still read the raw value. One medium issue remains: 00034 narrowed the key list and dropped names that 00033 masked and DB.md still promises. The owner needs to decide how wide the rule should be: an explicit list (current) or mask every `*_key` with an allow-list.

## Findings (ranked)

1. **MEDIUM: regression, key names 00033 masked are now plaintext.**
   - Where: `supabase/migrations/00034_audit_redact_failclosed.sql:12`, `src/lib/audit-redact.ts:8`, `docs/DB.md:35`.
   - `secret_re` and `SECRET_KEY` only mask names ending in `key` when they are `api_key`, `apikey`, `access_key` or `private_key`.
   - Verified live: `audit_redact('{"secret_key":"A1","client_key":"A2","webhook_key":"A3","signing_key":"A4","hmac_key":"A5","encryption_key":"A6","XApiKey":"A7","passphrase":"A8"}')` returns every value unmasked.
   - DB.md still lists `<auth|bot|webhook|client|…>_<token|secret|key>` as masked.
   - No current column uses these names, but `secret_key` is the usual name for a Stripe or Shopify "API secret key" field, so the brief's "any table" promise is broken.
   - Fix (owner picks one): (a) add `secret_key`, `client_key`, `webhook_key`, `auth_key`, `bot_key`, `signing_key`, `hmac_key`, `encryption_key` and `pass(word|phrase)` in both SQL and TS; or (b) fail closed and mask every key ending in `key`/`keys` except an allow-list (`*_id`, `idempotency_key`, `sort_key`, …). Then make DB.md match whichever is chosen.
   - New migration 00035; do not edit 00034.

2. **MEDIUM (ops): the backfill rewrites every `audit_log` row in one UPDATE.**
   - Where: `00034_audit_redact_failclosed.sql:57-60`.
   - There is no WHERE, so on the remote log it rewrites and locks the whole table even though almost no rows change.
   - Fix: `where old_row is distinct from audit_redact(old_row) or new_row is distinct from audit_redact(new_row)`. The redactor is idempotent, so this is safe.
   - Apply it in the next migration's backfill, which re-runs anyway after finding 1.

3. **LOW: dotted or spaced setting names are not normalised.**
   - Where: `00034…sql:25,28`, `audit-redact.ts:10`.
   - `{"key":"telegram.token","value":"S1"}` and `{"telegram.token":"…"}` stay in plaintext (verified live).
   - Fix: map `.`, space and `:` to `_` before matching.

4. **LOW: the value-prefix net is narrow and case-sensitive.**
   - Where: `00034…sql:44`, `audit-redact.ts:15`.
   - Not caught: `bearer x`, `shpca_`, `rk_live_`, `xoxb-`, Telegram `\d+:AA…`, JWT `eyJ…`, URLs carrying credentials.
   - Fix: match case-insensitively and add `shp[a-z]{2}_`, `rk_`, `xox[bp]-`, `^\d{6,}:AA`, `://[^/]*:[^@]*@`. This is defence in depth only.

5. **LOW: any literal `[redacted:xxxxxxxx]` value renders as a redaction badge.**
   - Where: `src/app/app/settings/audit/_lib/diff.ts:7,12`.
   - A user-typed product name of that form shows as a badge. This can mislead a reader; nothing leaks.
   - Fix: only show the badge when the key is a secret key, or accept as is.

6. **LOW (UI): light-theme Arabic screenshot is missing.**
   - Where: `docs/design/audit/`.
   - Present: dark EN (`SEC-1-en.png`), dark AR (`SEC-1-ar.png`), light EN (`SEC-1/light-en.png`, `light-current.png`). There is no light AR shot and no 390 px shot.
   - In the dark AR UPDATE row the from/to fingerprints read right to left against an LTR `→`. Check it reads correctly.

7. **LOW (a11y): the redacted pill's tooltip is `title` plus `aria-label` on a bare span.**
   - Where: `audit-table.tsx:19-25`.
   - Touch and keyboard users never see a `title` tooltip, and many screen readers ignore `aria-label` on a span with no role.
   - Fix: use the app's Radix Tooltip or add a role.

8. **INFO: the fingerprint is unsalted 8-hex SHA-256.** It is identical across workspaces and brute-forceable for low-entropy `password` values. The brief accepted this; audit_log is admin-only.

## Missing tests
- One shared table of cases run through both `auditRedact` and `rpc('audit_redact')` and asserted equal (SQL/TS parity). Include `secret_key`, `client_key`, `webhook_key`, `signing_key`, `passphrase`, `telegram.token`, `bearer x`, a non-ASCII value and a nested array.
- Live test that old_row is masked on UPDATE and DELETE, separately from new_row.
- Live test on a trigger table other than integration_configs (`zr_shipments` or `accounts`).
- Live assertion after the backfill: 0 `audit_log` rows with an unmasked secret key or a `whsec_`/`shp*_` value.
- An agent session gets permission denied on `rpc('audit_redact')`.
- `diffRows` cases: only the secret changed (two fingerprints shown), secret unchanged (no diff line), and a raw pre-backfill row masked by the TS layer.
