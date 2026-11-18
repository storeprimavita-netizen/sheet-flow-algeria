VERDICT: FIX

## Summary
Redaction works for the main case: `integration_configs.secret` and ZR `config.api_key` are masked, and both new test files pass (7 tests, live included).
The key regex both over-matches and under-matches. It masks `options.color_token` (the backfill already rewrote 28 local rows) and would mask `*_token_id`. It leaves non-string values and `settings` key/value tokens in clear.
The client table imports `node:crypto` through `audit-redact.ts`, which ships 419 kB of crypto-browserify. The AR changes cell is not bidi-isolated.
Reviewers: qa-reviewer (owasp-security) and ui-reviewer (browser: EN dark, EN light, AR dark).

## Findings (ranked)

1. **MEDIUM: non-string secrets are stored in clear.** `supabase/migrations/00033_audit_redact.sql:17-20` and `src/lib/audit-redact.ts:17`.
   - Failure: a key that matches is masked only when its value is a string. `audit_redact('{"tokens":{"access":"abc"},"api_keys":["k1"],"secret":12345}')` comes back unchanged. Nested OAuth objects or key lists in `config` would leak into `audit_log`, which breaks the done criterion.
   - Fix: when the key matches, mask the whole value whatever its type (keep JSON null as is). Do the same in SQL and TS.

2. **MEDIUM: the `settings` key/value shape gets past key matching.** Same function. `settings` is audited (00002:136).
   - Failure: D38 puts tracking API tokens and the Telegram bot token in Settings. A row such as `{"key":"telegram_bot_token","value":"123:AA…"}` is not masked, because neither key name matches and the value has no known prefix.
   - Fix: when an object's `key` field matches the pattern, mask its `value`. Add a test.

3. **MEDIUM: the key regex over-matches, and the backfill rewrite is permanent.** `00033_audit_redact.sql:18` and `audit-redact.ts:5`.
   - Failure: the substring match catches `color_token`, so 28 local option rows lost readable values (`rose`, `danger`). It would also catch `tracking_token_id` and any future `*_token_*` id.
   - The hash adds nothing for low-entropy values: an 8-hex sha256 of a few colour names can be reversed by lookup.
   - The backfill filter is also loose. `sk_` matches `stopdesk_fee`, which pulled in 70 `wilaya_fees` rows and 1 `settings` row. Those were rewritten unchanged, so no harm was done.
   - Fix: match whole name segments only, e.g. `(^|_)(secret|token|password|passwd|api_?key|apikey|authorization|signature)$`, so `color_token` and `*_token_id` are not masked. Anchor the backfill's value regex to string values rather than to the whole `::text` cast.
   - The remote `db push` stays owner-only. The PROGRESS note must say that the backfill rewrites `audit_log` in place.

4. **MEDIUM: 419 kB of browser crypto is bundled into the audit page.** `src/app/app/settings/audit/audit-table.tsx:8` imports from `src/lib/audit-redact.ts:1` (`node:crypto`).
   - Failure: `audit-table.tsx` is a client component, so the build ships crypto-browserify (`.next/static/chunks/13c0-*.js`, 419 kB) to the browser.
   - Fix: move `REDACTED_DISPLAY` and `showRedacted` into an import-free module, for example `audit-redact-display.ts`. Add `import "server-only"` to `audit-redact.ts`.

5. **MEDIUM (UI): the AR changes cell is not bidi-isolated.** `audit-table.tsx:27-34`.
   - Failure: in RTL, the UPDATE row renders as `" [redacted · …] " → " [redacted · …] " :secret`. The key moves to the end and from/to reads backwards. The INSERT row breaks the same way.
   - Fix: wrap each change in `<bdi dir="ltr">`, or give the cell `dir="ltr"` plus `text-start`.

6. **LOW: the test secret is still in the seed workspace.** The "MNW Seed" workspace has an active shopify `integration_configs` row with the screenshot webhook secret, plus audit rows 1361/1362.
   - Failure: local webhooks for that workspace can be forged with a known secret, and Settings shows Shopify as connected.
   - Fix: the builder created the row, so the builder should delete it (local data only) or document a reseed.

7. **LOW: 00033 was applied by hand.** `schema_migrations` stops at 00032, so the brief's `db reset` backfill check never ran.
   - Fix: run `supabase db reset` locally, then the `ilike` check.

8. **LOW: `audit_redact` is declared `immutable`, but `convert_to` is STABLE.** Anon and authenticated can also call it as an RPC.
   - Fix: mark it `stable`, and `revoke execute … from anon, authenticated`.

9. **LOW (UI): the pill is almost invisible in light theme.** `audit-table.tsx:30`.
   - Failure: `bg-muted` is close to the row background, and px-1 plus the literal quotes leaves stray gaps.
   - Fix: add `border border-border` or use `bg-secondary`, and strip the quotes around the pill.

10. **LOW (a11y): the explanation is a `title` tooltip only.** `audit-table.tsx:30`.
    - Failure: it cannot be focused with the keyboard and does not show on touch.
    - Fix: use the Radix Tooltip with `tabIndex=0`, or add an `aria-label` plus a one-line legend.

11. **LOW: user text can fake a redaction badge.** `audit-table.tsx:28-29`.
    - Failure: a name containing `[redacted · abcdef12]` renders as the badge. The regex is also built twice.
    - Fix: give the display form a marker that cannot be typed, or pass segments as structured data. Use one shared non-global regex.

## Missing tests
- Non-string values (object, array, number) under a secret key are masked. A `settings`-shaped `{key:"*_token", value}` row is masked.
- Negative cases: `color_token`, `tracking_token_id` and `stopdesk_fee` are not masked.
- Live: the ZR save path (`config.api_key` absent from `audit_log`) and the DELETE path (`old_row` masked).
- The brief's "absent from the page's rows": export and test `diffRows`, or the page's mapping.
- SQL/TS parity: the same fixtures through `audit_redact()` and `auditRedact()` give equal output.
- Screenshots: AR light and 390 px width.
