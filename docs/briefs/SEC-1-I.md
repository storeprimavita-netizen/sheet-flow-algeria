risk: low · surface: ui · lane: shell
(Plan L/ui, no migration, no DECISIONS row. Redaction core NOT touched. Audit dir: `src/app/(app)/app/settings/audit/`, call it AUDIT/.)

## Goal
Close SEC-1-H review-1 (5 lows, 2 missing tests) plus the two plan extras: timezone assumption and the possibly-English SEC-1-G "ar" shots.

## Done when
- Low 1: focus ring proven: `cmp` of focused vs unfocused pill shots (EN dark+light 390) differs; recorded in PROGRESS. Also assert the ring classes in `audit-table.test.tsx` stays (class check) but evidence is the shots.
- Low 2: ar empty-key test asserts the `dir` attribute on the element (render to tree/DOM, find the bdi containing `ar.audit.emptyKey`), not the markup string.
- Low 3: `states.test.tsx` error test finds the retry button by type `button`/label text (`t("common.retry")`-style key used in error.tsx), calls its onClick, asserts `unstable_retry` called once.
- Low 4: table filter shows labelled names, EN+AR (`audit.tables.<table>` keys, parity; fallback to raw name if missing), 21 entries grouped or sorted by label. Chip label uses the label too.
- Low 5: shared helper `src/lib/test-db.ts` (or existing test util dir) exporting the docker-inspect skip guard + `DB_CONTAINER`; `params.rls.test.ts` and `src/lib/audit-redact.rls.test.ts` import it. Behaviour unchanged (skip without DB).
- Missing test A: page-level test that `to=2026-03-01` yields `.lt("created_at","2026-03-02T00:00:00+01:00")` and `from` yields `.gte(... "T00:00:00+01:00")` (mock `createClient` + `requireAdminProfile`, call `AuditPage`, inspect recorded calls).
- Missing test B: below `sm` the changes list renders once: render the table cells and assert exactly one element per change set has `sm:hidden` and one `hidden sm:block`... (or exactly one changes list per breakpoint class); fails if a duplicate is added.
- Timezone: check `settings` / workspaces for a tz field (grep found none in migrations or src/lib). If none: keep `AUDIT_TZ = "+01:00"` in `_lib/params.ts`, document in a comment and `docs/DB.md` audit section ("fixed Algeria zone; no workspace tz setting"). If one exists, use it.
- SEC-1-G "ar" shots: retake or delete. Plan: delete `docs/design/audit/SEC-1-G/ar-*.png` (6 files, `git rm`); SEC-1-H shots are the live ones. Verify SEC-1-H ar shots are real Arabic (cookie `locale=ar`; page `<html lang/dir>` = ar/rtl via evaluate_script) before relying on them.
- Gate OK (full, live DB suite not skipped).

## Files
1. `AUDIT/audit-table.test.tsx` (l.64-66): dir-attribute assertion.
2. `AUDIT/states.test.tsx` (l.35): find button by role/label.
3. `AUDIT/audit-filter-bar.tsx` (+ `page.tsx` passing labels if needed), `src/messages/{en,ar}.json`: `audit.tables.*` for each of AUDITED_TABLES (take list from `_lib/params.ts`; add test that every AUDITED_TABLES entry has a key in both locales).
4. New `AUDIT/page.test.tsx`: query-bound test (missing test A).
5. `AUDIT/audit-table.test.tsx`: single-render test (B).
6. `AUDIT/_lib/params.rls.test.ts`, `src/lib/audit-redact.rls.test.ts`, new shared helper.
7. `AUDIT/_lib/params.ts` comment, `docs/DB.md` one line.
8. `git rm docs/design/audit/SEC-1-G/ar-*.png`.

## Steps (scripts/step.sh each)
1. Test fixes (lows 2, 3) + missing tests A, B. 2. Shared DB-skip helper (low 5). 3. Filter labels + keys + parity test (low 4). 4. Timezone note + delete SEC-1-G ar shots. 5. Screenshots + PROGRESS.

## Screenshots (docs/design/audit/SEC-1-I/, new dir)
`/app/settings/audit` EN+AR x dark+light at 1440 and 390, filter open showing labelled tables (EN dark, AR light), focused-pill vs unfocused EN dark+light 390 with `cmp` != identical. Confirm AR shot is RTL Arabic. Theme/locale via cookies `theme` / `locale` (NOT NEXT_LOCALE).

## Edge cases / assumptions
- Low 4 is optional per review; picked "labels" (not grouping): cheap, parity-checked.
- Tests mocking `page.tsx` must mock `@/lib/supabase/server` and `@/lib/rbac` (server-only imports); `getTranslations` may need mocking too.
- Timezone +01:00 stays (no tz setting found, Algeria has no DST).
- Contrast figures (7.0/6.4) still unverified by a reviewer: re-measure from computed styles and record.
- No new DECISIONS row needed.
