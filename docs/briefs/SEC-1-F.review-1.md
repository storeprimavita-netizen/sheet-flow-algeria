VERDICT: FIX

## Summary
The core security work holds. All seven names in the brief are masked. The allow-list is unchanged. Execute is revoked on all three functions (only postgres and service_role can run them). The backfill updates only rows that change. No path reaches a plaintext secret, and the unit tests pass (46/46).
Five medium findings block PASS. Two of them hide the pill in the UI (a nested `config` secret and the settings `value` column). DB.md promises more fingerprint parity than the code delivers. The backfill test is incomplete and its cleanup leaves raw rows behind. The Changes column cannot be seen at 390 px.
Reviewers: qa-reviewer (owasp-security), with probes run in rolled-back transactions on local Supabase; ui-reviewer, with screenshots of the live app.

## Findings (ranked)

1. **MEDIUM — a nested secret renders as a raw fake badge.** `src/app/app/settings/audit/_lib/diff.ts` `show()` and `audit-table.tsx:50`. On the ZR save path the screen shows the cell `config: {"api_key":"[redacted:16a36e86]","tenant_id":"t1"} → {...}`. The token is unlocalised, unstyled text, which is the exact case the brief names. `show()` only produces a badge when the whole value is a string. Fix: flatten object diffs to dotted keys (`config.api_key`) so each leaf goes through the secret and redacted logic, or render the JSON with masked tokens swapped for the pill. Add a `diffRows` test for this case.

2. **MEDIUM — settings rows lose the pill.** `_lib/diff.ts:15`. For a settings row such as `{key:"telegram.token", value:"[redacted:d2409090]"}` (the real SQL output), the cell shows plain text: `isSecretKey("value")` is false, and the raw value equals the redacted one because the DB already masked it. This breaks the acceptance test "masked DB value -> redacted: true" for key/value rows. Fix: when the row's `key` (`rawOld?.key ?? rawNew?.key`) is secret-named, treat the `value` column as secret. Add a test.

3. **MEDIUM — DB.md over-claims fingerprint parity.** `docs/DB.md:35` against `src/lib/audit-redact.ts:28`. jsonb orders object keys by byte length, but `jsonbText` sorts by UTF-16 length. So `{secret:{"ab":1,"ل":2}}` gives SQL `9412a42a` and TS `f7d1e754`, which matters in an Arabic-first app. `1.0` and integers above 2^53 also differ. Fix: sort keys by UTF-8 byte length and add cases for non-ASCII keys, floats, `{}`/`[]` and escapes to the shared table, or narrow the claim to string values (the brief allows this).

4. **MEDIUM — the backfill test never runs the backfill, and leaves raw rows behind.** `src/lib/audit-redact.rls.test.ts:124-135`. The test only calls `audit_redact`. It never runs the UPDATE and never checks that clean rows stay untouched. The `afterAll` cleanup fails silently: deleting the workspace cascades, the audit trigger inserts an `audit_log` row whose workspace no longer exists, and the foreign key aborts the delete. Local now holds 11 leaked `sec1-*` workspaces and 11 `x_backfill` rows with raw `XAPIKey` sentinels. Fix: run the real UPDATE limited to `where id in (...)` and compare before and after; check `error` on every cleanup call; delete the test's own audit rows. This also exposes a product issue: any workspace with audited child rows cannot be deleted. The owner should log that as a follow-up task, not fix it here.

5. **MEDIUM — the Changes column cannot be seen on a phone.** `src/app/app/settings/audit/audit-table.tsx:43`. At 390 px the table is 722 px wide inside a 466 px card that scrolls sideways, and Changes is the last column. The user sees only date, table and action, with no scroll hint. Fix: below `sm`, stack the changes under the row, or hide Agent and move Changes earlier.

6. **LOW — SQL and TS treat JSON null past the depth cap differently.** SQL masks a jsonb `null` at depth 65 or more (`audit_redact('null',65)` gives `[redacted:74234e98]`), while TS returns `null` (`audit-redact.ts:35`). Fix: drop the null skip in TS, or special-case null in SQL. Add depth cases at 64 and 65 to the shared table.

7. **LOW — run-together names are still unmasked in both SQL and TS.** `APISECRET`, `AUTHTOKEN`, `accesstoken`, `clientsecret`, `secretkey`, `api/key` and `api_key\t` all return false. These names are realistic for courier APIs, but no attacker can write such keys today. Widening the rule needs a D49 amendment, so this is an owner decision for a later task. Adding `/` and whitespace to the separators is in scope now.

8. **LOW — badge spoofing under a secret-named key.** An admin who stores the literal `[redacted:deadbeef]` in `api_key` gets a badge with a fingerprint they chose. Accepted risk, since only admins can do this.

9. **LOW — `role="note"` on a focusable span that also has `aria-label` and `title` makes screen readers announce it twice.** `audit-table.tsx:12-24`. Keep either `aria-label` or the visible text, not both.

10. **LOW — change lines touch the row borders.** `audit-table.tsx:44-46`. Add `py-2` to the `<ul>` or the cell.

11. **LOW — missing screenshot.** There is no `en-light-390.png` in `docs/design/audit/SEC-1-F/`.

12. **LOW — prefix-masked values under ordinary keys render as text, not a pill.** For example `note: "whsec_…"`. Cosmetic.

## Missing tests
- A `diffRows` case for a nested `config.api_key` and one for a settings key/value row with a secret key.
- The real backfill UPDATE, plus a check that untouched rows keep their content, with `afterAll` checking `error`.
- Execute denied on `audit_redact(jsonb,int)` and `audit_is_secret_key` (only the 1-argument overload is tested).
- Live parity at the depth cap (64 and 65, including null and a secret key at the boundary), for non-ASCII keys and for floats.
- Allow-list edge cases: `"Key "` and `_key_`, which trim to `key`.
- An audit-table render test: one `<ul>` per row, no `"; "`, pill present in EN and AR.
