# TEST-2 — flaky live-DB suites
risk: low · surface: none · lane: shell

## Goal
Live suites stop colliding (FK 23503 to a vanished workspace, timeouts); full gate green 5 runs in a row with the app running.

## Done when
- [ ] Root cause written in PROGRESS.md (with evidence from a repro loop, not a guess).
- [ ] No suite touches rows it did not create, and no suite's cleanup/backfill reaches another suite's workspace.
- [ ] `scripts/gate.sh` (full) green 5x consecutively with `npm run dev` up and no db-reset between runs; row counts of workspaces/orders/audit_log constant after run 1.
- [ ] No test deleted/weakened; protected paths untouched (see Assumptions).

## Findings from the code
- vitest runs files in parallel (no `fileParallelism` set, `vitest.config.ts` has no timeouts); ~18 live files each create workspaces.
- `seasons.rls.test.ts` "backfill seeds only the six seasons" runs the raw 00061 backfill via psql: `insert into seasons ... select w.id from workspaces w`, so it inserts seasons (audited) into EVERY workspace, including ones other files are deleting right now -> `seasons_workspace_id_fkey` / `audit_log_workspace_id_fkey`. Fix: scope the psql statement to `where w.id = '<w3>'` (string-replace the select) so it only touches w3.
- `deleteWorkspaces` (`src/lib/test-cleanup.ts`) clears seasons, season_periods, status_label_overrides only; any other audited table cascading on workspace delete (reviews.rls:74, cash_collections, audit-redact) fires `audit_row()` after the workspace row is gone -> FK 23503. Fix: derive the audited tables list once (query triggers calling audit_row via psql/pg_trigger, or a static list checked by a test) and delete them first, in one helper used by every suite; replace ad-hoc teardown in cash, reviews.rls, audit-redact, kpi, stock-stages with it.
- `deleteLeakedWorkspaces` uses prefix + 5 min age: safe, keep. Check other prefixes do not overlap ("ss-" vs others).
- Timeouts: heavy suites (kpi, seasons) seed hundreds of rows via REST under parallel load; give those `describe`/`beforeAll` explicit timeouts (per-file, not in vitest.config) or batch inserts.

## Steps (each committed with scripts/step.sh)
1. Repro: loop `npx vitest run` 10x with dev server up, capture failures to $TMPDIR; confirm which cause per failure.
2. Scope the seasons backfill psql to its own workspace.
3. Shared teardown helper in `test-cleanup.ts` covering all audited workspace-owned tables; migrate suites that delete workspaces.
4. Per-file timeouts / batched seeding for kpi + seasons beforeAll.
5. Run full gate 5x; record results in PROGRESS.md.

## Acceptance tests
Existing live suites unchanged in intent; add `test-cleanup.test.ts` (live): helper deletes a workspace holding rows in every audited table without error, and a concurrent second workspace is untouched.

## Edge cases / assumptions
- Fallback if isolation is not enough: `fileParallelism: false` or a pool setting, but that edits `vitest.config.ts` (a protected path): needs `GATE_ALLOW_PROTECTED=1` and owner OK. Prefer fixing isolation first; if needed, stop and ask.
- No DECISIONS row needed. No migration, no UI (no screenshots).
