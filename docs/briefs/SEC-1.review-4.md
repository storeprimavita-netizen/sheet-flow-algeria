VERDICT: ESCALATE

## Summary
Review round 4 (n ≥ 3, no PASS yet). This round found no high issues and two mediums. The DB wall works. `audit_row()` is unchanged (SECURITY DEFINER, `search_path=public, pg_temp`). There are no new grants. The 00035 backfill condition now matches 0 of 187 local rows, and no row holds a `whsec_`/`sk_`/`shpss_`/`shpat_`/`Bearer` value. Both test files pass against the live local stack (35/35). The page never shows a raw secret.
What is still open: D49's fail-closed name rule misses acronym-led and odd-case keys, in both SQL and TS. The audit table's separators break in RTL.
Under D40 the owner does not need to decide anything: there is no high finding and the gate is OK, so the task can be merged with M1/M2 logged as a follow-up. A fix round is the alternative, and that choice belongs to /decide.

## Findings

1. **MEDIUM, `supabase/migrations/00035_audit_redact_d49.sql:24,28` and `src/lib/audit-redact.ts:10`: acronym-led and odd-case keys are not masked.**
   - **Failure:** the camelCase split `([a-z0-9])([A-Z])` leaves a run of capitals joined to the next word. `APISecret`, `ZRToken`, `XAPIKey` and `IDKey` normalise to `apisecret`, `zrtoken` and so on, and stay in plaintext. Mixed case like `sEcReT` becomes `s_ec_re_t`. A trailing separator also escapes: `token_` and `"x_api_key "`. The reviewer confirmed all of these against both the SQL function and the TS function.
   - **Exposure today:** nothing, because every current writer uses snake_case. But D49's whole point is to mask a new integration field without anyone remembering to add it (for example, a provider's JSON stored as-is), and these keys break that.
   - **Fix:** in both places, apply `([A-Z]+)([A-Z][a-z])` → `\1_\2` before the existing split, then trim leading and trailing `_` and whitespace.
   - **Data:** add a new migration, 00036. Do not edit 00035. Use the same changed-rows-only backfill pattern.
   - **Tests:** cover `XAPIKey`, `APISecret`, `ZRToken`, `sEcReT` and `token_` on both the SQL and the TS side.

2. **MEDIUM, `src/app/app/settings/audit/audit-table.tsx:40-44`: change entries run together in AR.**
   - **Failure:** the `"; "` separator sits inside each `<bdi dir="ltr" class="inline-block">`. In RTL the entries render with no visible separator, for example `[redacted · 90f30038] → ∅config: {} → ∅`. Wrapped lines also start with a stray `;` in both locales. The admin can misread which value belongs to which field. Seen in light AR at 1280 px; dark AR was not checked.
   - **Fix:** render each change as its own block row (a `<div>`/`<li>`: key, from → to), keep `dir="ltr"` with `text-start` on each row, and drop the inline separator.

3. **LOW, `00035_audit_redact_d49.sql:33` vs `src/lib/audit-redact.ts:32`: the fingerprint of a non-string secret differs between SQL and TS.**
   - **Failure:** SQL hashes `v::text` and TS hashes `JSON.stringify` output, which differ in spacing and key order. For example, `{"secret":{"b":1,"a":2}}` gives `21501dba` in SQL and `a1d46c3c` in TS.
   - **Impact:** this only shows on rows the database did not redact, and none remain after the backfill. It still contradicts the "same rule" claim in DB.md.
   - **Fix:** hash a canonical form on both sides, or narrow the parity claim to string values.

4. **LOW, `00035_audit_redact_d49.sql` (the recursion): JSON nested beyond about 200–600 levels hits the PL/pgSQL stack limit.**
   - **Failure:** the audit trigger raises, so the write to `settings.value` or `integration_configs.config` fails. This fails closed and only admins can write those columns.
   - **Fix:** add a depth cap that masks the remaining subtree.

5. **LOW, `src/app/app/settings/audit/_lib/diff.ts:11`: the pill text `[redacted · xxxx]` is a literal English string shown in the AR UI.**
   This is already a D49 follow-up (review-3 #5). If it is localised, keep the hex part LTR-isolated.

6. **LOW, `src/app/app/settings/audit/audit-table.tsx:21-25`: `<span tabIndex=0>` with `title`/`aria-label` but no role.**
   - **Failure:** screen readers do not reliably announce it, and the tooltip only appears on hover. This is the D49 follow-up from review-3 #7.
   - **Fix:** use `role="note"`, or a visually hidden description linked with `aria-describedby`, or the design-system tooltip.

7. **LOW, `src/app/app/settings/audit/page.tsx` (the `?? r.actor` fallback): out of scope.**
   - **Failure:** the agent column shows a raw UUID when the actor is no longer a member.
   - **Fix:** show a "former user" label.

## Missing tests
- **SQL/TS parity:** one shared set of inputs run through `rpc('audit_redact')` and through `auditRedact`, with identical output required, fingerprints included.
- **Acronym-led and odd-case keys:** the M1 cases.
- **Unit tests for `_lib/diff.ts`:**
  - a secret-only change gives a fingerprint diff;
  - an unchanged secret gives no entry;
  - a missing key shows `∅`;
  - an already-masked DB value becomes the display form with `redacted: true`.
- **Render/HTML check:** the audit table output never contains `whsec_` or `sk_`.
- **Live ZR save path:** upsert `integration_configs.config = {tenant_id, api_key}` through the session client, then check that `audit_log` has no trace of the key.
- **Backfill test:** insert a raw row with the service role, run the 00035 UPDATE statement, and assert that row is scrubbed and the others are untouched.
- **Error check:** the settings insert in `src/lib/audit-redact.rls.test.ts` does not check its `error`.
