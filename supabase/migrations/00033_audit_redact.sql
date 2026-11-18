-- SEC-1: never store integration secrets in audit_log. Secret-looking keys or
-- values are replaced by a short fingerprint so a change is still visible.
create or replace function public.audit_redact(j jsonb)
returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  r jsonb;
  k text;
  v jsonb;
  s text;
begin
  if j is null then return null; end if;
  case jsonb_typeof(j)
    when 'object' then
      r := '{}'::jsonb;
      for k, v in select * from jsonb_each(j) loop
        if jsonb_typeof(v) = 'string' and v #>> '{}' <> ''
           and k ~* '(secret|token|password|passwd|api[_-]?key|apikey|authorization|signature)' then
          s := v #>> '{}';
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

create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public as $$
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

-- Backfill: scrub rows written before this migration (no deletes).
update public.audit_log
   set old_row = public.audit_redact(old_row),
       new_row = public.audit_redact(new_row)
 where old_row::text ~* '(secret|token|password|passwd|api[_-]?key|apikey|authorization|signature|whsec_|sk_|shpss_|shpat_|Bearer )'
    or new_row::text ~* '(secret|token|password|passwd|api[_-]?key|apikey|authorization|signature|whsec_|sk_|shpss_|shpat_|Bearer )';
