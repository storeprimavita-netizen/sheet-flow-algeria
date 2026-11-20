risk: high · surface: ui,security · lane: shell
(Plan says L/ui; the fix needs a SQL migration on a redaction function, so high. No new DECISIONS row: D40 follow-up of SEC-1-F review-3 option (a). Revised after review-0: M1-M5, L1-L11 resolved below.)

## Goal
SQL `audit_redact` and TS `auditRedact` give identical, idempotent output at the 64-level depth cap; SEC-1-F review-3 lows are fixed; 390 px audit screenshots retaken.

## Done when
- For every `PARITY_CASES` entry: SQL == TS, `f(f(x)) == f(x)` in both, and `TS(SQL(x)) == SQL(x)` (the page's real path).
- Strings matching `^\[redacted:[0-9a-f]{8}\]$` are returned unchanged at any depth. A secret key whose value is `""` or already masked is returned as is, even at depth 64 (SQL ADDS this rule before the depth check; today it recurses, which is the bug).
- No plaintext leak: only the exact 19-char token passes; deeper values are still hashed whole. Corner: `/sort_key`, `@cache_key`, `$color_token` were masked under 00037 and become visible once the separator class widens (allow-listed, harmless; documented).
- `diffRows` keeps colliding paths and empty keys distinct (own `id`); secret separators `[^a-zA-Z0-9]` masked in SQL and TS.
- Gate OK; DB.md parity claim true.

## Files
1. `supabase/migrations/00071_audit_redact_idempotent.sql` (latest is 00070; never edit 00036-38). `create or replace` BOTH `audit_redact(jsonb,int)` and `audit_is_secret_key`; NEVER `drop function`. Keep invoker (not security definer), volatility, `set search_path`; re-state `revoke all ... from public, anon, authenticated` on both. Changes: masked-string passthrough before the depth check; empty/masked-value short-circuit before the depth check; separator class `[^a-zA-Z0-9]` in both normalisations; plurals `secretkeys`/`privatekeys`. Backfill computes redaction once per row: `update audit_log a set old_row=s.o,new_row=s.n from (select id, audit_redact(old_row) o, audit_redact(new_row) n from audit_log) s where a.id=s.id and (a.old_row,a.new_row) is distinct from (s.o,s.n)`. No new table: checklist N/A, no type regen. Migrations are not run concurrently with writes: owner re-runs the "0 rows change" check after remote push (O-2).
2. `src/lib/audit-redact.ts`: same semantics; `sep` is `/[^a-zA-Z0-9]/gu` (the `u` flag is required, else an astral char becomes 2 `_` and SQL gives 1: review M1); plurals; masked passthrough at any depth.
3. `src/lib/audit-redact.cases.ts`: add `nest(64,{secret:""})`, `nest(64,{secret:"[redacted:aaaaaaaa]"})`, `nest(65,"[redacted:aaaaaaaa]")`; names `api/key`, `api_key\t`, `api+key`, `api,key`, `api key`, `secretkeys`, `privatekeys`, `idempotency😀key` (emoji); `/sort_key`, `@cache_key`, `$color_token`; visible `"Key "`, `_key_`.
4. `src/lib/audit-redact.test.ts` / `audit-redact.rls.test.ts`: idempotence and `TS(SQL(x))==SQL(x)` over `PARITY_CASES` (live SQL). Execute-denied tests use an agent session and an anon client on `audit_redact(j,depth)` and `audit_is_secret_key(k)` with correct args and assert error code `42501` (not just non-null: PGRST202 would pass wrongly). Backfill test: no `pg` driver and no new dependency, no RPC; run the exact UPDATE text from 00071 via `docker exec <db> psql` inside `begin ... rollback`; seed one row with only `old_row` raw; assert clean rows keep the same `xmin`.
5. `src/app/(app)/app/settings/audit/_lib/diff.ts`: flatten by segments array; map keyed by `JSON.stringify(segments)`; `DiffChange` gets `id` (same string) used as React key, `key` stays display only (`.` join; empty key gets a visible label via i18n, root `[]` distinct from `[""]`); drop `out.delete("")`; skip `updated_at`/`created_at` by comparing segments (top-level only). L4 decision: `show()` renders a pill for ANY value matching the masked regex (covers values masked at the cap under non-secret keys); document in DB.md. Arrays flattening (old L3): IN scope, elements get index segments so a secret inside shows a pill.
6. `audit-table.tsx`: `<li key={c.id}>`; pill `role="note"`, `tabIndex=0` kept only so keyboard users reach `title`; `aria-label` from i18n `audit.redactedAria` "Redacted value, code {fp}" EN+AR (parity); drop `dir` from the pill, keep `<bdi dir="ltr">` around the fingerprint only; `whitespace-nowrap` on pill; `break-all` on a `<span>` around the key only; `dir=ltr` on `<li>` so short lines are not inset. Add `loading.tsx` + `error.tsx` (reason + retry) for the route and an empty-state action; four states in scope. Check pill contrast (`text-muted-foreground` on `bg-secondary`) >= 4.5:1 in both themes, fix tokens if not.
7. `docs/DB.md` line 36: parity + idempotence rule, 00071, separator class, plurals, the L3 corner. `docs/DECISIONS.md`: append D49 amendment TEXT note for the wider class/plurals as owner-ack pending (list in PROGRESS, do not block).

## Steps (scripts/step.sh each)
1. Cases + failing tests. 2. 00071 + TS fix, green (`npx supabase db reset` local only; reseed needs the `server-only` stub per PROGRESS). 3. diff.ts + tests (collision, empty key vs root, nested `updated_at`, array of secrets). 4. audit-table + i18n + loading/error + render tests: `renderToStaticMarkup`, 2 `<ul>` per row (one per container: `sm:hidden` and `hidden sm:block`), no `"; "`, pill and aria-label with fingerprint in EN and AR, colliding paths render with no duplicate-key warning. 5. DB.md/DECISIONS. 6. Housekeeping via local psql only, never a migration: delete the leftover `zrexpress` `integration_configs` row first, then its audit rows. 7. Screenshots.

## Screenshots (docs/design/audit/SEC-1-G/{en,ar}-{dark,light}-{1440,390}.png; do not reuse SEC-1-F images)
All 8 combos, each showing a visible change list. Seed rows: pill, empty key, masked array, colliding path `{"a.b":1}` vs `{a:{b:1}}`, very long key without spaces, short line `is_active: ∅ → true`. Plus one focused-pill shot and one empty-state shot. Note result in PROGRESS.md.

## Edge cases / assumptions
- Redactor line refs match review-3; audit route is `src/app/(app)/app/settings/audit`.
- Floats and ints over 2^53 stay outside parity (documented).
- `audit_log` has no triggers, only an admin SELECT policy: backfill is safe. Local scan about 22 s on 167k rows.
- Remote `db push` of 00036-38 and 00071 is owner-only (O-2); D49 amendment ack (L6) open, not blocking.
