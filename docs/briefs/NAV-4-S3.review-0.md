VERDICT: FIX

## Summary
Brief review (qa-reviewer, owasp-security). The core design holds. In a rolled-back transaction on the local DB, the revoke and both default-privilege statements left anon able to execute 0 public functions, and authenticated and service_role kept every grant they had. handle_new_user still fires for supabase_auth_admin. No cron job, hook, policy, view or extension depends on PUBLIC execute. Every `.rpc(` caller is signed in or uses service role.
Three medium issues remain: a test that can never fail, a wrong DB.md rule, and a guard that passes even when the PUBLIC revoke is missing.

## Findings

1. **Medium: the anon `dashboard_stats` 42501 test cannot fail.** Location: brief line 43, `src/lib/anon-grants.rls.test.ts`. Anon already gets 42501 today, from the table ("permission denied for table orders"), so the test passes even if the function revoke is missing. Fix: assert the message matches `/permission denied for function/`. Also add anon rpc calls to `normalize_dz_phone`, `stock_order_reasons` and `is_admin`. Today all three succeed for anon, returning "0555123456", a list of reasons, and false.
2. **Medium: the planned DB.md rule is wrong.** Location: brief line 31, `docs/DB.md` lines 85-99. The rule says no new function inherits a grant. In fact, a new function in `public` still gets execute for authenticated and service_role from the schema default (probe: anon f, authenticated t, service_role t). So a future SECURITY DEFINER RPC can be called by agents unless it also revokes from authenticated (the 00046 pattern). In a new schema such as `private`, the opposite happens: a new function is executable by nobody, so any policy that calls it fails 42501 for every user. Fix: write both cases in DB.md, and note that the postgres default for `storage` still grants anon execute.
3. **Medium: the PUBLIC-default guard can pass without the revoke.** Location: brief line 28. With no global row in `pg_default_acl`, PUBLIC execute is implied rather than stored, so "no grantee 0" is true even when the revoke never ran. Fix: require a row with `defaclrole='postgres'::regrole`, `defaclnamespace=0`, `defaclobjtype='f'` and no grantee 0. Better: in the DO block, create `public.__s3_guard()`, assert that `has_function_privilege('anon',…)` and `has_function_privilege('public',…)` are both false, then drop it.
4. **Low: `on all functions` skips procedures.** Location: brief line 25. The DoD and guard sweep prokind `p`, but the revoke does not cover it. Fix: `revoke execute on all routines in schema public from public, anon;`, and make the guard and test sweep every prokind (aggregates are executable too).
5. **Low: on remote, the guard can block `db push` with no fix the owner can apply.** Location: brief lines 29 and 51. The `supabase_admin|public|f` default grants anon, so any extension installed into public, or any function owned by supabase_admin, trips the guard. Fix: raise only for postgres-owned functions that are not extension members (exclude `pg_depend.deptype='e'`), with a NOTICE count for the rest. Or keep the guard strict and record that choice for the owner.

Not a finding: re-granting to authenticated and service_role has no effect, because every function already names both roles in its ACL. It is harmless, so keep it as a safety net.

## Missing tests
- Anon rpc of `normalize_dz_phone` fails with `/permission denied for function/`.
- A sweep of `has_function_privilege('public', oid, 'execute')` over public functions returns nothing.
- Probe functions: in `public`, authenticated and service_role are true and anon is false. In a new schema, authenticated is false.
- Creating a user through the auth admin API after the migration still creates a profile (handle_new_user).
- An authenticated agent session calling `current_fx_rate` and `dashboard_stats` gets data back.
