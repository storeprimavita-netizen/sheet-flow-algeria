-- NAV-4-S2: anon holds no privilege on any table, view or sequence in public,
-- and objects created later by the migration owner inherit none (D20, AGENTS.md).
-- RLS already blocks anon; this removes the surface. Idempotent.
-- Functions are out of scope (NAV-4-S3). Schema USAGE is kept.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

notify pgrst, 'reload schema';

-- guard:begin  (REVOKE only warns on relations owned by another role)
do $$
declare n int;
begin
  select count(*) into n from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public';
  if n > 0 then
    raise exception 'NAV-4-S2: % anon table grant(s) remain in public', n;
  end if;
  select count(*) into n
    from pg_default_acl d
    join pg_namespace s on s.oid = d.defaclnamespace and s.nspname = 'public'
    join pg_roles o on o.oid = d.defaclrole and o.rolname = 'postgres',
    lateral aclexplode(d.defaclacl) a
    join pg_roles g on g.oid = a.grantee and g.rolname = 'anon'
   where d.defaclobjtype in ('r', 'S');
  if n > 0 then
    raise exception 'NAV-4-S2: anon default privileges remain for postgres in public';
  end if;
end $$;
-- guard:end
