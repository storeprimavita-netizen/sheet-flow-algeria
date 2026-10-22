-- ZR-2: ZR status sync with a stale guard.
-- State and situation each carry their own timestamp; the order follows the
-- shipment's STORED state (never the payload) inside the same transaction,
-- under the shipment row lock, so interleaved webhook/refresh/cron callers
-- converge on the newest state and stock moves once.

alter table public.zr_shipments
  add column state_slug   text,
  add column occurred_at  timestamptz,   -- timestamp of the stored state
  add column situation    text,
  add column is_return    boolean,
  add column situation_at timestamptz;   -- timestamp of the stored situation/isReturn

-- One shipment per (workspace, parcel); lets the RPC lock exactly one row.
create unique index zr_shipments_ws_parcel_uq on public.zr_shipments (workspace_id, parcel_id);

-- Webhook replay dedupe (Svix retries). Rejected/unsigned rows have null external_id.
create unique index webhook_events_dedupe_uq
  on public.webhook_events (provider, workspace_id, external_id)
  where external_id is not null;

create or replace function public.apply_zr_state(
  p_ws uuid, p_parcel uuid, p_state text, p_slug text,
  p_situation text, p_is_return boolean, p_occurred timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ship   public.zr_shipments;
  v_map    jsonb;
  v_mapped text;
begin
  if p_occurred is null then raise exception 'apply_zr_state: p_occurred is required'; end if;

  select * into v_ship from public.zr_shipments
   where workspace_id = p_ws and parcel_id = p_parcel
   for update;
  if not found then return null; end if;

  if p_state is not null then
    if v_ship.occurred_at is null or v_ship.occurred_at <= p_occurred then
      update public.zr_shipments
         set state = p_state, state_slug = p_slug,
             occurred_at = p_occurred, state_updated_at = p_occurred
       where order_id = v_ship.order_id
       returning * into v_ship;
    end if;

    -- order follows the STORED state (a stale payload re-syncs to the newest)
    select value -> 'map' into v_map from public.settings
     where workspace_id = p_ws and key = 'zr_state_map';
    if not found then   -- never configured: built-in defaults
      v_map := '{"livre":"delivered","encaisse":"delivered","recouvert":"delivered","recupere_par_fournisseur":"returned"}';
    end if;
    v_mapped := v_map ->> lower(btrim(v_ship.state));
    if v_mapped is not null then
      update public.orders set delivery_status = v_mapped::delivery_status
       where id = v_ship.order_id and workspace_id = p_ws
         and delivery_status is distinct from v_mapped::delivery_status;
    end if;
  elsif v_ship.situation_at is null or v_ship.situation_at <= p_occurred then
    update public.zr_shipments
       set situation = coalesce(p_situation, situation),
           is_return = coalesce(p_is_return, is_return),
           situation_at = p_occurred
     where order_id = v_ship.order_id;
  end if;

  return v_ship.order_id;
end; $$;

revoke execute on function public.apply_zr_state(uuid, uuid, text, text, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_zr_state(uuid, uuid, text, text, text, boolean, timestamptz)
  to service_role;

-- Default map for workspaces that never set one; an owner-set map is untouched.
insert into public.settings (workspace_id, key, value)
select id, 'zr_state_map',
  '{"map":{"livre":"delivered","encaisse":"delivered","recouvert":"delivered","recupere_par_fournisseur":"returned"}}'::jsonb
from public.workspaces
on conflict do nothing;
update public.settings
   set value = '{"map":{"livre":"delivered","encaisse":"delivered","recouvert":"delivered","recupere_par_fournisseur":"returned"}}'::jsonb
 where key = 'zr_state_map' and value = '{"map":{}}'::jsonb;
