-- CONF-1 review-1: tighten order_views at the DB (names, seed_key, position, per-group cap).

alter table public.order_views
  add constraint order_views_name_trimmed check (name = btrim(name) and char_length(name) between 1 and 60),
  add constraint order_views_seed_shared check (seed_key is null or owner_id is null),
  add constraint order_views_position_nonneg check (position >= 0);

-- Cap of 20 views per (workspace, scope, shared | owner). Advisory lock makes check-then-insert race-free.
create or replace function public.order_views_cap()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    new.workspace_id::text || new.scope || coalesce(new.owner_id::text, 'shared'), 0));
  select count(*) into n from public.order_views v
   where v.workspace_id = new.workspace_id and v.scope = new.scope
     and v.owner_id is not distinct from new.owner_id;
  if n >= 20 then
    raise exception 'order view limit reached' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
create trigger order_views_cap before insert on public.order_views
  for each row execute function public.order_views_cap();
