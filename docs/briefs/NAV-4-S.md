risk: high · surface: security · lane: shell (db migration 00074)

# NAV-4-S — revoke anon grants on `public.options` (and `option_sets`)

Goal: `anon` holds no privilege on `public.options` / `public.option_sets` (AGENTS.md: no anon table grants), with a live test; behaviour for signed-in users unchanged.

## Definition of done
- `information_schema.role_table_grants` has no row for grantee `anon` on `options` or `option_sets`.
- An anon-key client gets 42501 (permission denied, not an empty set) on select/insert/update/delete of both tables.
- `authenticated` keeps SELECT/INSERT/UPDATE/DELETE on both (admin/agent flows and RLS tests unchanged); service_role unchanged.
- `scripts/gate.sh` passes; DB.md notes it.

## Findings (real code)
- Local DB: anon has 7 privileges on ~38 public tables (Supabase default privileges since 00001 `grant usage ... to anon`); RLS policies on `options` are all `to authenticated`, so today it is a surface, not a leak. Precedent: `00040_product_pricing_revoke_anon.sql` (`revoke all ... from anon`), 00042 loop, 00064.
- Latest migration is 00073; next is `00074_options_revoke_anon.sql`.
- No code reads options as anon: public store uses the server-only DAL (service role); the app uses the session client (`authenticated` JWT). Grep `from("options")` in src to confirm no path runs with the anon role before login (login page must not read options).
- Scope: task names `options` only. `option_sets` has the identical defect and is its parent, so include it. The other ~36 tables are NOT in scope: needs a follow-up plan row (sweep of all anon grants + `alter default privileges ... revoke ... from anon`), owner/decide call since it touches every table. No DECISIONS row needed for this task.

## Files
1. `supabase/migrations/00074_options_revoke_anon.sql`: `revoke all on public.options from anon; revoke all on public.option_sets from anon;` Idempotent, no data change, no RLS change. Table checklist items (workspace_id, RLS, triggers, types) are N/A: no schema change; `database.types.ts` does not change.
2. `src/lib/nav4.rls.test.ts` (or new `src/lib/options.anon.rls.test.ts`, same live-DB harness `describe.skipIf(!URL)`): new tests below.
3. `docs/DB.md`: on the `options` row add "00074: anon has no grant (also `option_sets`)". `docs/MASTER_PLAN.md`: add follow-up row for the all-tables anon sweep.

## Steps (each commit + push via scripts/step.sh)
1. Migration 00074 + `supabase db reset`/local apply, verify grants by psql.
2. Tests (anon grants, anon 42501, authenticated still works).
3. DB.md + plan follow-up row; gate.

## Acceptance tests
- `options: anon has no table grant` (grants query, both tables)
- `options: anon select/insert/update/delete all error 42501`
- `option_sets: anon select error 42501`
- `options: admin still inserts/updates; confirmation agent still reads` (existing nav4 tests must stay green)
- `seed_workspace` still runs (psql as postgres, unaffected).

## Edge cases
- Revoking from `anon` only: `authenticated` is a separate role; the logged-in JWT never uses `anon`. Do not revoke `public` schema usage.
- Future tables get anon grants again through default privileges; mitigation is the follow-up sweep, not this task.
- Supabase cloud may re-grant on `db push`? No: explicit REVOKE persists; owner pushes remote.
