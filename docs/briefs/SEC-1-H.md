risk: low · surface: ui · lane: shell
(Plan L/ui, no migration, no DECISIONS row: D85 answers it. Redaction core is NOT touched.)

## Goal
Close the open SEC-1-G points (D85 a-e) on `/app/settings/audit`: flaky backfill test, pill focus ring + real shots, readable path labels, lows 4,5,6,8,9, missing tests.

## Done when
- Backfill test sets `lock_timeout` and skips (not fails) when the DB container is absent.
- Redacted pill shows a ring on `:focus-visible`; contrast measured both themes and recorded in PROGRESS; focused shot differs from unfocused (`cmp` != identical).
- Display key: array index `[0]`; object keys containing `.` or ` › ` are JSON-quoted; `{"a.b":1}` -> `"a.b"`, `{a:{b:1}}` -> `a › b`, `{items:[{x}]}` -> `items › [0] › x`, key `"0"` -> `"0"`? NO: only quote when it contains `.`/` › `; a key `0` stays `0`, an index is `[0]`, so they differ.
- AR empty-key label in `<bdi dir="rtl">`; `from=2026-02-31` dropped; table filter lists every audited table; data table accepts a per-column class; `to` cutoff has a fixed zone.
- Missing tests (review-3) exist. Gate OK (full, live DB suite not skipped).

## Files
1. `src/lib/audit-redact.rls.test.ts` (~l.166): `psql` script starts with `set lock_timeout='5s';` inside the txn; guard at top of the backfill test: `docker inspect DB_CONTAINER` fails -> `ctx.skip()` (use `test.skipIf` computed once). Add tests: 42501 for 1-arg `audit_redact(j)` as agent and anon (assert code 42501).
2. `src/lib/audit-redact.cases.ts`: add token with trailing newline and uppercase-hex fake token under a secret key (SQL==TS parity; pins anchoring). Do not change redactor code; if parity fails, stop and report.
3. `_lib/diff.ts` (`key: segments.join`): new `label(segments)`: number -> `[n]`, string with `.` or ` › ` -> `JSON.stringify`, joined by ` › `. `id` unchanged. Update `diff.test.ts`: colliding labels differ for `{"a.b"}` vs `{a:{b}}`, index vs key "0", key containing ` › `.
4. `audit-table.tsx`: pill class add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; empty-key label `<bdi dir="rtl">` only when locale is ar is overkill: always wrap `<bdi dir="auto">` is wrong for EN parens, so use `<bdi>` with `dir` from `useLocale()` (ar -> rtl). Replace `width: "hidden sm:table-cell"` hacks with new `className`.
5. `src/components/data-table/types.ts` + `data-table.tsx`: `className?: string` on Column, applied to th and td; keep `width` semantics; other callers untouched.
6. `page.tsx`: DATE refine `new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s`; `AUDITED_TABLES` = every table with an `audit_row` trigger (derive: `select event_object_table from information_schema.triggers where action_statement like '%audit_row%'` on local DB; then hardcode and add a test that a lived list == DB list, skipped without DB). `to`: `lt` next-day-start `${to}T00:00:00+01:00` shifted +1 day (Algeria has no DST); `from`: `gte ${from}T00:00:00+01:00`. i18n: table names in the filter bar come from `audit-filter-bar.tsx`; if it needs labels for new tables add `en/ar` keys (parity).
7. Tests: `page` URL validation (extract `parseAuditParams(sp)` to `_lib/params.ts`, pure, unit-tested: impossible date, non-uuid actor, unknown table dropped); render tests: empty, filtered-empty (Clear link href), `loading.tsx`, `error.tsx` (retry calls `unstable_retry`), colliding labels both visible.
8. `docs/DB.md`/PROGRESS only if the filter list is documented there.

## Steps (scripts/step.sh each)
1. Backfill test + 42501 test + cases. 2. diff label + tests. 3. params.ts + page + table list + tests. 4. Column className + table + pill ring + render tests. 5. Contrast + screenshots + PROGRESS.

## Screenshots (docs/design/audit/SEC-1-H/, new dir, do not reuse old)
Seed one row where BOTH `a.b` and `a › b` lines change, an array secret `[0]`, a key containing ` › `, an empty key, a pill. Full-page {en,ar}-{dark,light}-{1440,390}; plus focused-pill dark+light (Tab to pill, then `cmp` vs unfocused). Measure contrast of `text-muted-foreground` on `bg-secondary` from computed styles in both themes; record numbers (builder figure earlier: 7.0 light, 6.4 dark, unverified).

## Edge cases / assumptions
- Audited-table list stale vs triggers (cash_collections, stores, store_pages, product_pricing, accounts, reviews, seasons, season_periods, option_sets, options, product_options*...); take it from the DB, not memory.
- Timezone `+01:00` is my assumption (no workspace tz setting checked); if settings has one, use it.
- `DB_CONTAINER` default `supabase_db_mnw-erp`.
- No new DECISIONS row needed.
