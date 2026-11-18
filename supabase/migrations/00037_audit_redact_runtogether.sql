-- SEC-1-F (D49 amendment): explicit run-together secret names are masked.
-- Replaces audit_is_secret_key from 00036 (not edited); audit_redact calls it so it needs no change.
create or replace function public.audit_is_secret_key(k text)
returns boolean
language sql immutable set search_path = public, pg_temp as $$
  with n as (
    select
      lower(btrim(regexp_replace(regexp_replace(regexp_replace(btrim(k, ' '), '([A-Z]+)([A-Z][a-z])', '\1_\2', 'g'), '([a-z0-9])([A-Z])', '\1_\2', 'g'), '[-. :]', '_', 'g'), '_')) as a,
      lower(btrim(regexp_replace(btrim(k, ' '), '[-. :]', '_', 'g'), '_')) as b
  )
  select coalesce(bool_or(
    x ~ '(^|_)(keys?|tokens?|secrets?|password|passwd|pwd|passphrase|credentials?|authorization|signature|apikeys?|secretkey|accesstoken|authtoken|privatekey|clientsecret|webhooksecret|bottoken)$'
    and x !~ '^(keys?|idempotency_key|sort_key|cache_key|(color|design|theme)_tokens?)$'
  ), false)
  from n, lateral (values (n.a), (n.b)) v(x);
$$;

revoke execute on function public.audit_is_secret_key(text) from public, anon, authenticated;

-- Backfill: only rows that change are rewritten.
update public.audit_log
   set old_row = public.audit_redact(old_row),
       new_row = public.audit_redact(new_row)
 where old_row is distinct from public.audit_redact(old_row)
    or new_row is distinct from public.audit_redact(new_row);
