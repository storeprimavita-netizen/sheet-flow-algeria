risk: high · surface: security · lane: shell (db migration 00076)

# NAV-4-S3 — anon loses EXECUTE on every public function

Goal: `anon` can execute no function in `public`, and functions created later by `postgres` inherit none for anon; signed-in and service-role behaviour is unchanged.

## Definition of done
- `has_function_privilege('anon', oid, 'execute')` is false for every `pg_proc` row in `public` (prokind f/p).
- `pg_default_acl` (postgres, public, `f`) has no anon entry; global default for postgres no longer gives PUBLIC execute on functions.
- `authenticated` keeps execute on the RLS helpers and every RPC it calls today; `service_role` unchanged. All `*.rls.test.ts` + `scripts/gate.sh` green.
- Review-1 lows of S2 fixed (guard and test 1 see sequence, matview and column grants; dashboard_stats asserts 42501).
- DB.md S3 note replaced by the rule; MASTER_PLAN row ticked at ship.

## Findings (real code, local DB checked 2026-11-20)
- Next migration: `00076_revoke_anon_function_execute.sql` (latest is 00075).
- 26 public functions are anon-executable, all owner postgres: RLS helpers `current_workspace_id`, `current_app_role`, `is_admin`; 17 trigger functions (handle_new_user, guard_*, audit_row, order_stock_*, ...); `set_updated_at`, `normalize_dz_phone`, `current_fx_rate`, `stock_order_reasons`, `order_stock_target`, `dashboard_stats(...)`. All via the implicit PUBLIC default, so `revoke ... from anon` alone does nothing: must revoke from `public` too.
- `pg_default_acl`: `postgres|f|public` lists anon, authenticated, service_role =X (that is the anon default to drop); `supabase_admin|f|public` has the same (platform-owned, do not touch, owner note). No `postgres` global (no-schema) function entry, so PUBLIC execute default still applies.
- Already locked (revoked from public/anon): kpi_*, pnl_*, transition_order_status, variant_label, stock_count_variants, save_variant_config, delivery_fee_for. Those are the 00046 pattern; keep.
- No anon app path: server.ts/client.ts carry user JWT, store DAL and cron/webhooks use service role (D20); login only calls `auth.*`. Grep `.rpc(` before migrating to confirm no signed-out caller. No storage/realtime policy calls a public function (0 found).
- Trigger functions need no EXECUTE at fire time (checked only at CREATE TRIGGER), so revoking is safe. RLS helpers are evaluated as the querying role: authenticated must keep them.

## Files
1. `supabase/migrations/00076_revoke_anon_function_execute.sql`:
   - `revoke execute on all functions in schema public from public, anon;`
   - re-grant to `authenticated, service_role`: `current_workspace_id`, `current_app_role`, `is_admin`, `normalize_dz_phone`, `current_fx_rate`, `dashboard_stats`, `order_stock_target`, `stock_order_reasons` (any function authenticated had before; derive the list from a pre-migration `has_function_privilege('authenticated')` snapshot, grant only those; trigger functions get no re-grant except where a test proves it is needed).
   - `alter default privileges for role postgres in schema public revoke execute on functions from anon;`
   - `alter default privileges for role postgres revoke execute on functions from public;` (global, no `in schema`; then new functions need explicit grants: say so in DB.md and the 00046 pattern).
   - `notify pgrst, 'reload schema';`; guard DO block last (`-- guard:begin/end`): raise if any public function is anon-executable, or default ACLs still give anon/PUBLIC execute for postgres. Use `pg_proc` + `has_function_privilege`, not information_schema.
   - Also tighten the 00075 check (cannot edit 00075; put the stronger relation guard in 00076): pg_class relkind r,p,v,m,f with `has_table_privilege` / `has_any_column_privilege('anon', oid, 'select,insert,update,references')`, relkind S with `has_sequence_privilege`.
2. `src/lib/anon-grants.rls.test.ts`: extend (functions, relation check on pg_class, dashboard_stats `error.code === '42501'`, insert/update message `/permission denied for table/`).
3. `docs/DB.md`: replace "Follow-up NAV-4-S3" paragraph with the rule, the new-function line ("every new function needs an explicit grant; none is inherited"), the owner post-push query.
4. `database.types.ts` unchanged (verify `gen types` diff empty).

## Steps (scripts/step.sh each)
1. Snapshot authenticated execute list; write 00076; `supabase db reset`; psql verify.
2. Extend tests; run live rls tests.
3. Walk the app as agent and admin (orders, stock, stats, settings) with the gate's suites; DB.md; `scripts/gate.sh`.

## Acceptance tests
- `anon cannot execute any public function` (pg_proc sweep, empty)
- `default privileges: postgres gives anon and PUBLIC no function execute`
- `a function created after the migration is not anon-executable`: psql `begin; create function public.__s3_probe() returns int language sql as 'select 1'; has_function_privilege('anon',...)` false; `rollback`.
- `anon rpc dashboard_stats fails 42501`
- `authenticated keeps execute on current_workspace_id, is_admin, current_app_role, dashboard_stats` and `agent session still reads orders/ writes via RLS` (existing suites)
- `service_role keeps execute on kpi/pnl helpers`
- `anon has no column, matview or sequence privilege` (pg_class sweep)

## Edge cases / for the owner
- Remote: the guard fails `db push` if `supabase_admin`-owned functions in public (extensions installed into public) stay anon-executable; REVOKE only warns for other owners. Owner runs the same query after push.
- `supabase_admin` function default ACLs stay (platform-owned). Do not toggle `auto_expose_new_tables`.
- Global default revoke from PUBLIC affects only future postgres-created functions in all schemas; storage/auth schemas are owned by other roles, so unaffected. Confirm after `supabase stop && start`.
- No new DECISIONS row needed (D20 and the S2 precedent).
