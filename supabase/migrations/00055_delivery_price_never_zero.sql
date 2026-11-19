-- P1-7 round 4 (D62): 0 is never a delivery price. Flags first (no price is changed), then the rules.
update public.wilaya_fees set priced = false where priced and home_fee <= 0;
update public.wilaya_fees set stopdesk_available = false where priced and stopdesk_available and stopdesk_fee <= 0;

alter table public.wilaya_fees
  add constraint wilaya_fees_priced_home_positive check (not priced or home_fee > 0),
  add constraint wilaya_fees_priced_desk_positive check (not (priced and stopdesk_available) or stopdesk_fee > 0);

create or replace function public.apply_delivery_prices(p jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  ws uuid := public.current_workspace_id();
  w jsonb;
  v_code smallint;
  v_home numeric;
  v_desk numeric;
  v_priced boolean;
  v_avail boolean;
  v_total_communes int := 0;
  v_changed int := 0;
  n int;
begin
  if not public.is_admin() or ws is null then raise exception 'admin only'; end if;
  if coalesce(jsonb_typeof(p->'wilayas'), '') <> 'array' then raise exception 'wilayas must be an array'; end if;
  if jsonb_array_length(p->'wilayas') > 58 then raise exception 'too many wilayas'; end if;
  for w in select * from jsonb_array_elements(p->'wilayas') loop
    v_code := (w->>'code')::smallint;
    if v_code < 1 or v_code > 58 then raise exception 'bad wilaya code %', v_code; end if;
    v_priced := coalesce((w->>'priced')::boolean, true);
    v_avail := coalesce((w->>'stopdesk_available')::boolean, true);
    v_home := coalesce((w->>'home_fee')::numeric, 0);
    v_desk := coalesce((w->>'stopdesk_fee')::numeric, 0);
    if v_home < 0 or v_desk < 0 or v_home in ('NaN', 'Infinity') or v_desk in ('NaN', 'Infinity') then
      raise exception 'fee must be a finite number >= 0';
    end if;
    if v_priced and (w->>'home_fee') is null then raise exception 'priced wilaya needs home_fee'; end if;
    if v_priced and v_home <= 0 then raise exception 'priced wilaya needs a home fee above 0'; end if;
    if v_priced and v_avail and (w->>'stopdesk_fee') is null then raise exception 'stop-desk wilaya needs stopdesk_fee'; end if;
    if v_priced and v_avail and v_desk <= 0 then raise exception 'stop-desk wilaya needs a stop-desk fee above 0'; end if;
    v_total_communes := v_total_communes + coalesce(jsonb_array_length(w->'communes'), 0);
    if v_total_communes > 5000 then raise exception 'too many communes'; end if;
    if exists (select 1 from jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)) c
               where char_length(c) < 1 or char_length(c) > 100) then
      raise exception 'commune name length';
    end if;

    -- fees: an unpriced wilaya keeps its stored fees (priced=false hides them)
    update public.wilaya_fees wf set
        home_fee = case when v_priced then v_home else wf.home_fee end,
        stopdesk_fee = case when v_priced and v_avail then v_desk else wf.stopdesk_fee end,
        priced = v_priced,
        stopdesk_available = v_avail
      where wf.workspace_id = ws and wf.wilaya_code = v_code
        and (wf.priced is distinct from v_priced
             or wf.stopdesk_available is distinct from v_avail
             or (v_priced and wf.home_fee is distinct from v_home)
             or (v_priced and v_avail and wf.stopdesk_fee is distinct from v_desk));
    get diagnostics n = row_count;
    v_changed := v_changed + n;
    if not found then
      insert into public.wilaya_fees (workspace_id, wilaya_code, home_fee, stopdesk_fee, priced, stopdesk_available)
        values (ws, v_code, case when v_priced then v_home else 0 end,
                case when v_priced and v_avail then v_desk else 0 end, v_priced, v_avail)
        on conflict (workspace_id, wilaya_code) do nothing;
    end if;

    -- communes: replace the listed wilaya's set, touching only the difference
    delete from public.wilaya_communes c
      where c.workspace_id = ws and c.wilaya_code = v_code
        and c.name not in (select jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)));
    insert into public.wilaya_communes (workspace_id, wilaya_code, name)
      select distinct ws, v_code, x from jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)) x
      on conflict do nothing;
  end loop;
  return jsonb_build_object('fees_changed', v_changed);
end; $$;
revoke all on function public.apply_delivery_prices(jsonb) from public, anon;
grant execute on function public.apply_delivery_prices(jsonb) to authenticated;
