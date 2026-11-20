VERDICT: PASS

## Summary
Diff `git diff v3...v3-NAV-4-S2` reviewed by qa-reviewer (owasp-security) against the brief and D20, verified on the local DB.
anon holds no privilege on any public relation (role_table_grants, column grants, has_table_privilege over r/p/v/m/f/S all empty); postgres default ACL for r/S no longer lists anon; anon OpenAPI root lists no tables; anon gets 42501 on tables and `dashboard_stats`.
authenticated/service_role grants unchanged; no app path (store DAL, webhooks, cron, login, proxy) relies on anon. Migration idempotent. Test file passes 9/9 live. All review-0 findings addressed.
No high or medium findings; low hardening below is recommended but not blocking. No owner decision needed.

## Findings (ranked)

1. **Low** — `supabase/migrations/00075_revoke_anon_public_sweep.sql:15-20`, `src/lib/anon-grants.rls.test.ts:22-27`
   Guard and test 1 query `information_schema.role_table_grants`, which does not show sequence, materialized-view or column-level grants (proved in a rolled-back txn: anon grant on a new matview, a sequence and one column of a table → role_table_grants 0, `has_*_privilege` true). On remote, a public sequence owned by another role would make REVOKE only warn and the guard still pass; a future `grant select (col) on <table> to anon` passes test 1 and the `select("*")` 42501 test. Current state is clean (has_*_privilege sweep finds nothing).
   Fix: base guard and test 1 on `pg_class` (relkind r,p,v,m,f) with `has_table_privilege` / `has_any_column_privilege('anon', oid, 'select,insert,update,references')`, plus `has_sequence_privilege` for relkind S; put that query in DB.md as the owner's post-push check.

2. **Low** — `src/lib/anon-grants.rls.test.ts:96-99`
   `dashboard_stats` assertion is `error !== null`, which also passes on PGRST202 (signature drift) or any unrelated error.
   Fix: assert `r.error?.code === "42501"`.

3. **Low** — `src/lib/anon-grants.rls.test.ts:89`
   Insert 42501 would also occur from RLS WITH CHECK rejection without this migration; only update/delete prove the grant is gone.
   Fix: also assert message matches `/permission denied for table/`.

4. **Low (owner awareness, already in DB.md)** — `supabase_admin` default ACLs in public still give anon `arwdDxtm` (tables) / `rwU` (sequences). Objects created in public as `supabase_admin` (e.g. an extension enabled into public from the dashboard, like PostGIS `spatial_ref_sys`) inherit anon grants. If one exists remotely the guard fails `db push` (intended); later ones are only caught by the local test.

5. **Low (process)** — brief step 4: the `NAV-4-S3` row in `docs/MASTER_PLAN.md` is not there yet (note exists in DB.md). Add at ship.

## Missing tests
- Column-level, sequence and matview anon grants via `has_*_privilege` (see finding 1).
- Authenticated baseline across all public relations in `pg_class` (today only 4 tables + 1 view).
