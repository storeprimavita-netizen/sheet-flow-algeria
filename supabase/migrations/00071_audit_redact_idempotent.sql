-- SEC-1-G (D40 follow-up of SEC-1-F review-3): audit_redact is idempotent at the depth cap and
-- matches the TS twin on every separator.
--  * a masked string ('[redacted:xxxxxxxx]') is returned unchanged at any depth (before the cap);
--  * a secret key whose value is '' or already masked is kept as is, even at depth 64
--    (before, it recursed to depth 65 and was hashed again);
--  * name separators are every non [a-zA-Z0-9] character (was only - . space :);
--  * plurals secretkeys / privatekeys are secret.
-- Corner (documented in DB.md): '/sort_key', '@cache_key', '$color_token' were masked under 00037
-- and are visible now (they normalise to an allow-listed name).
-- create or replace only (00036-38 not edited); owner/volatility/search_path and grants as before.
create or replace function public.audit_is_secret_key(k text)
returns boolean
language sql immutable set search_path = public, pg_temp as $$
  with n as (
    select
      lower(btrim(regexp_replace(regexp_replace(regexp_replace(btrim(k, ' '), '([A-Z]+)([A-Z][a-z])', '\1_\2', 'g'), '([a-z0-9])([A-Z])', '\1_\2', 'g'), '[^a-zA-Z0-9]', '_', 'g'), '_')) as a,
      lower(btrim(regexp_replace(btrim(k, ' '), '[^a-zA-Z0-9]', '_', 'g'), '_')) as b
  )
  select coalesce(bool_or(
    x ~ '(^|_)(keys?|tokens?|secrets?|password|passwd|pwd|passphrase|credentials?|authorization|signature|apikeys?|secretkeys?|accesstoken|authtoken|privatekeys?|clientsecret|webhooksecret|bottoken)$'
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
  if j is null or jsonb_typeof(j) = 'null' then return j; end if; -- JSON null is kept at any depth
  if jsonb_typeof(j) = 'string' and j #>> '{}' ~ '^\[redacted:[0-9a-f]{8}\]$' then return j; end if; -- already masked: idempotent at any depth
  if depth > 64 then
    return to_jsonb('[redacted:' || left(encode(sha256(convert_to(j::text, 'utf8')), 'hex'), 8) || ']');
  end if;
  case jsonb_typeof(j)
    when 'object' then
      r := '{}'::jsonb;
      is_kv := jsonb_typeof(j->'key') = 'string' and public.audit_is_secret_key(j->>'key');
      for k, v in select * from jsonb_each(j) loop
        is_secret := public.audit_is_secret_key(k) or (is_kv and k = 'value');
        if jsonb_typeof(v) <> 'null' and is_secret then
          if jsonb_typeof(v) = 'string' and (v #>> '{}' = '' or v #>> '{}' ~ '^\[redacted:[0-9a-f]{8}\]$') then
            r := r || jsonb_build_object(k, v); -- empty or already masked: kept, not re-hashed at the cap
          else
            s := case when jsonb_typeof(v) = 'string' then v #>> '{}' else v::text end;
            r := r || jsonb_build_object(k, '[redacted:' || left(encode(sha256(convert_to(s, 'utf8')), 'hex'), 8) || ']');
          end if;
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

revoke all on function public.audit_is_secret_key(text) from public, anon, authenticated;
revoke all on function public.audit_redact(jsonb, int) from public, anon, authenticated;

-- Backfill: redaction computed once per row; only rows that change are rewritten.
update public.audit_log a
   set old_row = s.o, new_row = s.n
  from (select id, public.audit_redact(old_row) o, public.audit_redact(new_row) n from public.audit_log) s
 where a.id = s.id
   and (a.old_row, a.new_row) is distinct from (s.o, s.n);
