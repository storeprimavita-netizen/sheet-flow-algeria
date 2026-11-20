risk: high · surface: ui,security · lane: shell
(Plan says L/ui; the fix needs a SQL migration on a redaction function, so it is high. No new DECISIONS row: D40 follow-up of SEC-1-F review-3, option (a).)

## Goal
SQL `audit_redact` and TS `auditRedact` give identical, idempotent output at the 64-level depth cap; SEC-1-F review-3 lows (L1-L5, housekeeping) are fixed; 390 px audit screenshots retaken.

## Done when
- For every case in `PARITY_CASES`, SQL == TS, and `f(f(x)) == f(x)` in both.
- Strings matching `^\[redacted:[0-9a-f]{8}\]$` are returned unchanged at any depth, including past the cap.
- A secret key whose value is `""` or already masked is returned as is, never recursed (at depth 64 too).
- No plaintext leak is introduced: both sides mask the same or more.
- `diffRows` shows colliding paths and empty-key changes; secret separators `[^a-zA-Z0-9]` are masked on both sides.
- Pill has `role="note"` + `aria-label`; RTL 390 px rows are not inset, pill does not wrap.
- DB.md parity claim is true and states the idempotence rule. Gate OK.

## Files
1. `supabase/migrations/00071_audit_redact_idempotent.sql` (latest file is 00070; do not edit 00036-00038). `create or replace audit_redact(jsonb,int)` (grants are kept; re-state the revoke from anon/authenticated). Change: before the depth check, if `j` is a string matching the masked regex, return `j`. Keep the secret-key branch's "empty or masked -> recurse-free" rule ahead of the depth cap. Widen the separator class in `audit_is_secret_key` to `[^a-zA-Z0-9]` (both normalisations) and add plural `secretkeys`/`privatekeys`; replace that function too. Then the backfill: `update audit_log set old_row=audit_redact(old_row), new_row=audit_redact(new_row) where ... is distinct from` (rewrites contents only, none deleted). No table, so the new-table checklist does not apply. Regenerate types not needed.
2. `src/lib/audit-redact.ts`: same: masked string kept at any depth; widen `sep` to `/[^a-zA-Z0-9]/g`; add the plurals; keep the "secret key with empty/masked value" short-circuit before the depth check.
3. `src/lib/audit-redact.cases.ts`: add `nest(64,{secret:""})`, `nest(64,{secret:"[redacted:aaaaaaaa]"})`, `nest(65,"[redacted:aaaaaaaa]")`, names `api/key`, `api_key\t`, `api+key`, `api,key`, `api key`, `secretkeys`, `privatekeys`; visible `"Key "`, `_key_`.
4. `src/lib/audit-redact.test.ts` / `audit-redact.rls.test.ts`: idempotence over `PARITY_CASES` (TS and live SQL); "cannot execute" tests use a real agent session (not admin) and cover `audit_redact(jsonb,int)` and `audit_is_secret_key` for anon and authenticated; backfill test runs the real SQL `UPDATE` on seeded rows incl. `old_row`.
5. `src/app/(app)/app/settings/audit/_lib/diff.ts`: key the leaf map by `JSON.stringify(segments)` (L1), drop the `out.delete("")` hack; render path with `.` only in display. Optional (L3): flatten arrays so a secret inside shows a pill. `diff.test.ts`: colliding `{"a.b":1,a:{b:1}}`, empty key, array of secrets.
6. `src/app/(app)/app/settings/audit/audit-table.tsx`: pill `role="note"` + `aria-label` (i18n key in `src/messages/{en,ar}.json`, parity), `whitespace-nowrap` on pill, `break-all` on key, `dir=ltr` on the `<li>` so short lines are not inset (L4, L5). Add a render test: one `<ul>` per row, no `"; "`, pill in EN and AR.
7. `docs/DB.md` line 36: parity/idempotence text, 00071, separator class.

## Steps (commit each with scripts/step.sh)
1. Cases + failing tests. 2. 00071 + TS fix, tests green (`npx supabase db reset` local only; reseed needs the `server-only` stub per PROGRESS). 3. diff.ts + tests. 4. audit-table + i18n + render test. 5. DB.md. 6. Housekeeping: delete the leftover local `zrexpress` `integration_configs` row and its audit rows. 7. Screenshots.

## Screenshots (docs/design/audit/SEC-1-G/)
`/app/settings/audit` in EN and AR, dark and light, at 1440 and 390 px (all 8 combos, none missing). Seed a row with a secret, a change under an empty key and a masked array. Note result in PROGRESS.md.

## Edge cases / assumptions
- Confirmed stale-free: redactor code matches review-3 line refs; migration numbers have moved to 00070, so use 00071.
- Audit route is now under `src/app/(app)/app/settings/audit`.
- Floats and integers over 2^53 stay outside the parity guarantee (documented).
- Idempotence must hold after the widened separator class; re-run the "0 rows change under audit_redact" check on local `audit_log`.
- Remote `db push` of 00036-00038 and 00071 is owner-only (O-2); owner ack of the D49 run-together amendment (L6) is still open: list in PROGRESS, do not block.
