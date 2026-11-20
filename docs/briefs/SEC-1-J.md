risk: low · surface: ui · lane: shell

# SEC-1-J: SEC-1-I review lows

Goal: close the four lows in `docs/briefs/SEC-1-I.review-1.md` with no behaviour change except the audit row label.

## Done when
- docs/DB.md `audit_log` Purpose cell reads "... expenses + product_costs. Audit page date filters ..." (line 45).
- Audit rows show the localized `audit.tables.<name>` label; unknown table falls back to the raw name; the raw name is always in `title` and wrapped in `<bdi dir="ltr">`.
- `audit-table.test.tsx` "changes list renders once per breakpoint class" no longer matches exact class strings.
- `audit-redact.rls.test.ts` live block uses the shared `dbContainerUp` guard, not env `URL`.
- `scripts/gate.sh` passes; no new i18n keys (en/ar parity untouched).

## Files and changes
1. `docs/DB.md:45`: insert ". " after `product_costs`.
2. `src/app/(app)/app/settings/audit/audit-table.tsx:58`: replace `{r.table_name}` with a small `TableName` helper: `const t = useTranslations(); const label = t.has(\`audit.tables.${n}\`) ? t(\`audit.tables.${n}\`) : n;` render `<span title={n}>{label}</span>` with raw name in `<bdi dir="ltr">` only when it falls back. Same lookup already in `audit-filter-bar.tsx:28`: extract one shared helper (e.g. `_lib/table-label.ts` or a hook) and use it in both, so the two cannot drift.
3. `audit-table.test.tsx:77-79`: count `<ul` inside elements by structure instead: render, assert `match(/<ul/g)` length 2 and that exactly one `<ul` has an ancestor with `sm:hidden` and one with `sm:block` via a regex on class tokens (`/class="[^"]*\bsm:hidden\b[^"]*"><ul/`, `/class="[^"]*\bsm:block\b[^"]*"><ul/`). Add tests: row shows `audit.tables.<x>` label in en and ar; unknown table shows raw name; `title` holds raw name.
4. `src/lib/audit-redact.rls.test.ts:12,24`: `describe.skipIf(!dbContainerUp)`; default `URL = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321"` (keys already default to local demo keys). Other files (`my-day.rls.test.ts`) keep env-only: out of scope.

## Steps (each committed with scripts/step.sh)
1. DB.md fix.
2. Shared table-label helper + use in row and filter bar + tests.
3. Test class-string de-brittling.
4. rls.test guard.
5. Gate; screenshots; PROGRESS.md.

## Acceptance tests
- audit-table.test.tsx: label en/ar, fallback, title, breakpoint test.
- audit-filter-bar tests still pass (helper extraction).
- audit-redact.rls.test.ts runs when the docker db is up, skips cleanly when not.

## Screenshots (UI task, both themes, AR + EN, 390 + desktop)
`/app/settings/audit` rows with a translated table name; pick a filter and confirm row label matches the chip. No browser MCP: say so.

## Edge cases / assumptions
- AUDITED_TABLES has 22 entries; parity test already guarantees all have labels.
- Raw name in AR must stay LTR: `<bdi dir="ltr">`.
- Mobile branch (sm:hidden) renders the table cell once; label change applies to both.
- Assumption: local API URL default 127.0.0.1:54321 (AGENTS.md). If env keys differ the test already honors env overrides.
- No migration, no new DECISIONS row needed.
