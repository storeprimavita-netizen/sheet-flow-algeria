-- SEC-1: never store integration secrets in audit_log. Secret-looking keys or
-- values are replaced by a short fingerprint so a change is still visible.
create or replace function public.audit_redact(j jsonb)
returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  r jsonb;
  k text;
  v jsonb;
  s text;
  -- Explicit secret key names (whole key, case-insensitive). Ordinary keys such
  -- as color_token or tracking_token_id are NOT matched.
  key_re constant text := '^(secret|secrets|token|tokens|password|passwd|api[_-]?keys?|authorization|signature|(access|refresh|api|auth|bot|webhook|client|private)[_-](token|secret|key))$';
  -- `settings` rows are {key, value}: the value is secret when the key name ends so.
  name_re constant text := '(secret|token|password|passwd|api[_-]?key|authorization|signature)$';
  is_kv boolean;
begin
  if j is null then return null; end if;
  case jsonb_typeof(j)
    when 'object' then
      r := '{}'::jsonb;
      is_kv := jsonb_typeof(j->'key') = 'string' and lower(j->>'key') ~ name_re;
      for k, v in select * from jsonb_each(j) loop
        if jsonb_typeof(v) <> 'null'
           and (lower(k) ~ key_re or (is_kv and k = 'value'))
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

create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ws uuid; v_id text;
begin
  if tg_op = 'DELETE' then
    v_ws := (to_jsonb(old)->>'workspace_id')::uuid;
    v_id := to_jsonb(old)->>'id';
  else
    v_ws := (to_jsonb(new)->>'workspace_id')::uuid;
    v_id := to_jsonb(new)->>'id';
  end if;
  insert into public.audit_log(workspace_id, actor, table_name, row_id, action, old_row, new_row)
  values (v_ws, auth.uid(), tg_table_name, v_id, tg_op,
          case when tg_op <> 'INSERT' then public.audit_redact(to_jsonb(old)) end,
          case when tg_op <> 'DELETE' then public.audit_redact(to_jsonb(new)) end);
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

-- Backfill: scrub rows written before this migration, in place (no deletes).
-- Rewrites audit_log rows; owner runs the remote push.
update public.audit_log
   set old_row = public.audit_redact(old_row),
       new_row = public.audit_redact(new_row)
 where old_row::text ~* '"(secret|token|password|passwd|api[_-]?keys?|authorization|signature|[a-z]+[_-](token|secret|key))"|"(whsec_|shpss_|shpat_|sk_|Bearer )'
    or new_row::text ~* '"(secret|token|password|passwd|api[_-]?keys?|authorization|signature|[a-z]+[_-](token|secret|key))"|"(whsec_|shpss_|shpat_|sk_|Bearer )';
