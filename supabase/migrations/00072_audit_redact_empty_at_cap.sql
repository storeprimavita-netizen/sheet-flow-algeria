-- SEC-1-G review-1 M2: an empty string is kept at any depth (like JSON null), so audit_redact stays idempotent at the cap.
-- Only audit_redact(jsonb,int) is replaced; grants unchanged (revoked from public/anon/authenticated).
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
  if jsonb_typeof(j) = 'string' and j #>> '{}' = '' then return j; end if; -- empty string kept at any depth (idempotent at the cap)
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

revoke all on function public.audit_redact(jsonb, int) from public, anon, authenticated;
