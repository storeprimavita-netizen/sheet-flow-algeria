-- SEC-1-F (D49 completion): acronym-led and odd-case secret names are masked, and
-- recursion is capped. A name is secret if EITHER normalisation is secret and not allowed:
--  a) btrim spaces, split acronyms (XAPIKey -> XAPI_Key), split camelCase, separators -> '_',
--     lowercase, btrim '_';
--  b) case-only: lowercase, separators -> '_', btrim '_' (catches sEcReT).
-- Replaces 00035 (not edited).
create or replace function public.audit_is_secret_key(k text)
returns boolean
language sql immutable set search_path = public, pg_temp as $$
  with n as (
    select
      lower(btrim(regexp_replace(regexp_replace(regexp_replace(btrim(k, ' '), '([A-Z]+)([A-Z][a-z])', '\1_\2', 'g'), '([a-z0-9])([A-Z])', '\1_\2', 'g'), '[-. :]', '_', 'g'), '_')) as a,
      lower(btrim(regexp_replace(btrim(k, ' '), '[-. :]', '_', 'g'), '_')) as b
  )
  select coalesce(bool_or(
    x ~ '(^|_)(keys?|tokens?|secrets?|password|passwd|pwd|passphrase|credentials?|authorization|signature|apikeys?)$'
    and x !~ '^(keys?|idempotency_key|sort_key|cache_key|(color|design|theme)_tokens?)$'
  ), false)
  from n, lateral (values (n.a), (n.b)) v(x);
$$;

create or replace function public.audit_redact(j jsonb, depth int)
returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  r jsonb;
  k text;
  v jsonb;
  s text;
  is_secret boolean;
  is_kv boolean;
begin
  if j is null then return null; end if;
  if depth > 64 then
    return to_jsonb('[redacted:' || left(encode(sha256(convert_to(j::text, 'utf8')), 'hex'), 8) || ']');
  end if;
  case jsonb_typeof(j)
    when 'object' then
      r := '{}'::jsonb;
      is_kv := jsonb_typeof(j->'key') = 'string' and public.audit_is_secret_key(j->>'key');
      for k, v in select * from jsonb_each(j) loop
        is_secret := public.audit_is_secret_key(k) or (is_kv and k = 'value');
        if jsonb_typeof(v) <> 'null'
           and is_secret
           and not (jsonb_typeof(v) = 'string' and (v #>> '{}' = '' or v #>> '{}' ~ '^\[redacted:[0-9a-f]{8}\]$')) then
          s := case when jsonb_typeof(v) = 'string' then v #>> '{}' else v::text end;
          r := r || jsonb_build_object(k, '[redacted:' || left(encode(sha256(convert_to(s, 'utf8')), 'hex'), 8) || ']');
        else
          r := r || jsonb_build_object(k, public.audit_redact(v, depth + 1));
        end if;
      end loop;
      return r;
    when 'array' then
      return coalesce((select jsonb_agg(public.audit_redact(e, depth + 1)) from jsonb_array_elements(j) e), '[]'::jsonb);
    when 'string' then
      s := j #>> '{}';
      if s ~ '^(whsec_|sk_|shpss_|shpat_|Bearer )' then
        return to_jsonb('[redacted:' || left(encode(sha256(convert_to(s, 'utf8')), 'hex'), 8) || ']');
      end if;
      return j;
    else
      return j;
  end case;
end; $$;

create or replace function public.audit_redact(j jsonb)
returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select public.audit_redact(j, 0);
$$;

revoke execute on function public.audit_is_secret_key(text) from public, anon, authenticated;
revoke execute on function public.audit_redact(jsonb, int) from public, anon, authenticated;
revoke execute on function public.audit_redact(jsonb) from public, anon, authenticated;

-- Backfill: only rows that change are rewritten.
update public.audit_log
   set old_row = public.audit_redact(old_row),
       new_row = public.audit_redact(new_row)
 where old_row is distinct from public.audit_redact(old_row)
    or new_row is distinct from public.audit_redact(new_row);
