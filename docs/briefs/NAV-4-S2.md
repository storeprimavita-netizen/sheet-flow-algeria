risk: high · surface: security · lane: shell (db migration 00075)

# NAV-4-S2 — sweep every remaining `anon` table grant in `public`

Goal: `anon` holds no privilege on any table/view/sequence in `public`, and new objects created by the migration owner no longer inherit one; signed-in and service-role behaviour unchanged.

## Definition of done
- `information_schema.role_table_grants` has no `anon` row for schema public (tables and views).
- Anon-key client gets 42501 (not empty set) on select of every table in a representative list, incl. views.
- `pg_default_acl` for role `postgres` in schema public has no `anon` entry for tables (r) and sequences (S).
- `authenticated` and `service_role` grants unchanged; all existing `*.rls.test.ts` + `scripts/gate.sh` green.
- DB.md states the rule; NAV-4-S2 row ticked at ship.

## Findings (real code, local DB checked)
- Latest migration is 00074; next is `00075_revoke_anon_public_sweep.sql`.
- 35 relations still grant anon 7 privileges (arwdDxtm), incl. 5 views (agent_performance, customer_stats, product_stats, wilaya_stats, workspace_performance) and `profiles`, `orders`, `settings`, `webhook_events`: RLS is the only wall today. Anon also has USAGE on sequences, and EXECUTE on 26 public functions (via PUBLIC default).
- `pg_default_acl` carries `anon=arwdDxtm` (tables), `rwU` (sequences) for owners `postgres` and `supabase_admin`. Migrations run as `postgres`, so alter that; `supabase_admin` defaults are platform-owned (do not touch; note for owner).
- No app path uses the anon role against tables: `server.ts`/`session.ts`/`client.ts` send the user JWT (role authenticated) once signed in; public store uses server-only DAL on service role (D20). Login only calls `auth.*`. Confirm by grep `.from(` in `src/app/login`, `src/proxy.ts`, and any route handler that builds a client without a session.
- Precedent: 00040, 00042, 00046, 00074. D20 already says "no anon table grants", so no new DECISIONS row is needed for tables.

## Files
1. `supabase/migrations/00075_revoke_anon_public_sweep.sql`:
   - `revoke all on all tables in schema public from anon;` (covers views)
   - `revoke all on all sequences in schema public from anon;`
   - `alter default privileges for role postgres in schema public revoke all on tables from anon;` and same for sequences.
   - Do NOT revoke schema USAGE, do NOT touch functions (see Edge cases). Idempotent; no RLS/data/type change (`database.types.ts` unchanged).
   - End with `notify pgrst, 'reload schema';` (anon OpenAPI root stops listing tables/cost columns).
   - Guard `DO` block last (00070 precedent): `raise exception` if any `information_schema.role_table_grants` row for `anon` in public remains, or `pg_default_acl` (postgres, public) still lists anon for r/S. On remote REVOKE only warns on objects owned by other roles, so the guard keeps `db push` from "succeeding" silently. Give the owner the same query to run after push.
2. `src/lib/anon-grants.rls.test.ts` (live harness like `options.anon.rls.test.ts`, `describe.skipIf(!URL)`).
3. `docs/DB.md`: add "anon has no grant on any public relation (00075); new tables inherit none". Add checklist line: "after creating a table, no anon grant expected".
4. Optional: gate-style check in the test (not gate.sh) that fails when any anon grant exists.

## Steps (each via scripts/step.sh)
1. Migration 00075; `supabase db reset` locally; verify by psql.
2. Test file.
3. DB.md; run `scripts/gate.sh`.
4. Create a task-note for NAV-4-S3 (plan row at ship) recording: (a) until S3, each new SECURITY DEFINER RPC needs its own revoke from public/anon (00046 pattern); (b) PUBLIC execute default is only removed by a global `alter default privileges for role postgres revoke execute on functions from public` (no `in schema`).

## Acceptance tests
- `anon has no grant on any public table or view` (grants query, empty)
- `anon has no sequence privilege in public`
- `default privileges: postgres/public gives anon nothing` (pg_default_acl)
- `anon select on orders, profiles, settings, wilayas, agent_performance errors 42501`
- `a table, view and sequence created after the migration get no anon grant`: via psql (as `options.anon.rls.test.ts:10`) `begin; create table public.__nav4s2_probe(id serial); create view public.__nav4s2_v as select 1;` assert `has_table_privilege('anon', ...)` false for both and `has_sequence_privilege('anon','public.__nav4s2_probe_id_seq','usage')` false; `rollback`. (A temp table is useless: it lives in pg_temp, default ACLs never apply.)
- `anon select fails 42501 on every table/view/matview in public` (enumerate from `pg_class`, catches future tables)
- `anon insert/update/delete on orders and settings fail 42501`
- `anon call to dashboard_stats errors`
- `authenticated and service_role keep absolute grants`: `has_table_privilege('authenticated', t, 'select,insert,update,delete')` on orders, profiles, settings, wilayas; select on agent_performance; service_role full rights.
- Existing nav4, variants, seasons, delivery-prices, audit-redact RLS tests stay green.

## Edge cases / for the owner
- `wilayas`, `wilaya_fees`, `zr_territories` look like reference data; verify no pre-login screen or store DTO reads them as anon (store DAL uses service role, so expected fine). If a grep finds one, grant SELECT back to that table only and say so.
- Functions: PUBLIC/anon EXECUTE on 26 public functions is a separate surface (security-definer RPCs are the real risk). Out of scope: add follow-up row `NAV-4-S3` (sweep function execute, `alter default privileges ... revoke execute on functions from public, anon`).
- Do not toggle `auto_expose_new_tables` (config.toml:23-27) or the cloud Data API equivalent: it may re-add anon defaults and authenticated defaults depend on it. Note in DB.md; re-run the check if toggled. After `supabase stop && supabase start`, confirm `pg_default_acl` has no anon entry.
- `supabase_admin` default ACLs and the remote project are owner-only; remote `db push` stays the owner's step.
- No new DECISIONS row required. The plan's "owner/decide call" is satisfied by D20; /decide may confirm.
