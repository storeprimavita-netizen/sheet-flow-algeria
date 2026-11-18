-- SEC-1 D49 (review-3 #1-#3): fail closed. Keys are normalised (camelCase, '-', '.',
-- space and ':' to '_', lowercase) and masked when their LAST segment is
-- key/token/secret/password/... except a short allow-list. Replaces 00034.
create or replace function public.audit_redact(j jsonb)
returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  r jsonb;
  k text;
  v jsonb;
  s text;
  secret_re constant text := '(^|_)(keys?|tokens?|secrets?|password|passwd|pwd|passphrase|credentials?|authorization|signature|apikeys?)$';
  allow_re constant text := '^(keys?|idempotency_key|sort_key|cache_key|(color|design|theme)_tokens?)$';
  kn text;
  is_secret boolean;
  is_kv boolean;
begin
  if j is null then return null; end if;
  case jsonb_typeof(j)
    when 'object' then
      r := '{}'::jsonb;
      is_kv := false;
      if jsonb_typeof(j->'key') = 'string' then
        kn := lower(regexp_replace(regexp_replace(j->>'key', '([a-z0-9])([A-Z])', '\1_\2', 'g'), '[-. :]', '_', 'g'));
        is_kv := kn ~ secret_re and kn !~ allow_re;
      end if;
      for k, v in select * from jsonb_each(j) loop
        kn := lower(regexp_replace(regexp_replace(k, '([a-z0-9])([A-Z])', '\1_\2', 'g'), '[-. :]', '_', 'g'));
        is_secret := (kn ~ secret_re and kn !~ allow_re) or (is_kv and k = 'value');
        if jsonb_typeof(v) <> 'null'
           and is_secret
           and not (jsonb_typeof(v) = 'string' and (v #>> '{}' = '' or v #>> '{}' ~ '^\[redacted:[0-9a-f]{8}\]$')) then
          s := case when jsonb_typeof(v) = 'string' then v #>> '{}' else v::text end;
          r := r || jsonb_build_object(k, '[redacted:' || left(encode(sha256(convert_to(s, 'utf8')), 'hex'), 8) || ']');
        else
          r := r || jsonb_build_object(k, public.audit_redact(v));
        end if;
      end loop;
      return r;
    when 'array' then
      return coalesce((select jsonb_agg(public.audit_redact(e)) from jsonb_array_elements(j) e), '[]'::jsonb);
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

revoke execute on function public.audit_redact(jsonb) from public, anon, authenticated;

-- Backfill: idempotent redactor, so only rows that change are rewritten.
update public.audit_log
   set old_row = public.audit_redact(old_row),
       new_row = public.audit_redact(new_row)
 where old_row is distinct from public.audit_redact(old_row)
    or new_row is distinct from public.audit_redact(new_row);
