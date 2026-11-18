-- SEC-1-F review-2 M1: jsonb null stays null past the depth cap, matching src/lib/audit-redact.ts.
-- Replaces audit_redact(jsonb,int) from 00036 (not edited); grants are preserved by create or replace.
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
  if j is null or jsonb_typeof(j) = 'null' then return j; end if; -- JSON null is kept at any depth (TS twin parity)
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
