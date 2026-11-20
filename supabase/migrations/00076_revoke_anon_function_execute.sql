-- NAV-4-S3: anon (and PUBLIC) execute no function in public; functions created
-- later by postgres inherit none for anon/PUBLIC (D20, AGENTS.md). Idempotent.
-- Routines (functions, procedures, aggregates) are all covered.
-- PUBLIC must be revoked too: the implicit PUBLIC default is what gave anon access.
revoke execute on all routines in schema public from public, anon;

-- Safety net: what signed-in sessions and the service role call today.
grant execute on function
  public.current_workspace_id(), public.current_app_role(), public.is_admin(),
  public.normalize_dz_phone(text),
  public.current_fx_rate(uuid, currency_code),
  public.order_stock_target(delivery_status, integer, boolean, boolean, confirmation_status),
  public.stock_order_reasons()
  to authenticated, service_role;
grant execute on function public.dashboard_stats(
  date, date, uuid[], integer[], order_source[], uuid[], uuid[],
  confirmation_status[], delivery_status[], uuid[])
  to authenticated, service_role;

alter default privileges for role postgres in schema public revoke execute on functions from anon;
-- global (no "in schema"): drops the implicit PUBLIC execute default for future postgres functions
alter default privileges for role postgres revoke execute on functions from public;

notify pgrst, 'reload schema';

-- guard:begin  (only postgres-owned, non-extension functions can block a push)
do $$
declare n int; m int; g oid;
begin
  if not exists (
    select 1 from pg_default_acl d
     where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
       and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)
  ) then
    raise exception 'NAV-4-S3: global postgres function default still gives PUBLIC execute';
  end if;
  if exists (
    select 1 from pg_default_acl d
      join pg_namespace s on s.oid = d.defaclnamespace and s.nspname = 'public',
      lateral aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'f'
       and (a.grantee = 0 or a.grantee = 'anon'::regrole)
  ) then
    raise exception 'NAV-4-S3: public-schema function default still gives anon/PUBLIC execute';
  end if;

  create function public.__s3_guard() returns int language sql as 'select 1';
  if has_function_privilege('anon', 'public.__s3_guard()', 'execute')
     or has_function_privilege('public', 'public.__s3_guard()', 'execute') then
    raise exception 'NAV-4-S3: new public function is executable by anon/PUBLIC';
  end if;
  drop function public.__s3_guard();

  select count(*) filter (where p.proowner = 'postgres'::regrole
                            and not exists (select 1 from pg_depend dd where dd.classid = 'pg_proc'::regclass
                                              and dd.objid = p.oid and dd.deptype = 'e')),
         count(*) filter (where not (p.proowner = 'postgres'::regrole
                            and not exists (select 1 from pg_depend dd where dd.classid = 'pg_proc'::regclass
                                              and dd.objid = p.oid and dd.deptype = 'e')))
    into n, m
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname = 'public'
   where has_function_privilege('anon', p.oid, 'execute');
  if n > 0 then
    raise exception 'NAV-4-S3: % postgres-owned public function(s) still anon-executable', n;
  end if;
  if m > 0 then
    raise notice 'NAV-4-S3: % non-postgres/extension public function(s) still anon-executable (owner check)', m;
  end if;

  -- tightened 00075 check: columns, matviews, foreign tables, sequences
  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
   where c.relowner = 'postgres'::regrole
     and ((c.relkind in ('r','p','v','m','f')
           and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
                or has_any_column_privilege('anon', c.oid, 'select,insert,update,references')))
       or (c.relkind = 'S' and has_sequence_privilege('anon', c.oid, 'usage,select,update')));
  if n > 0 then
    raise exception 'NAV-4-S3: % public relation(s) still carry an anon privilege', n;
  end if;
end $$;
-- guard:end
