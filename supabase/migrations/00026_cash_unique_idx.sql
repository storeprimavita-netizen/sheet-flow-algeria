-- P0-5: one cash row per order, tenant-safe order link, audited.

-- guard:begin
-- Never auto-delete money rows: abort and let the owner resolve after a backup.
do $$
declare n bigint;
begin
  select count(*) into n from (
    select order_id from public.cash_collections
    where order_id is not null group by order_id having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'duplicate cash_collections: % order_id(s) have more than one row; resolve manually (after backup) then re-run', n;
  end if;
end $$;
-- guard:end

-- A plain unique INDEX (not a constraint): finance/overview embeds
-- cash:cash_collections(id) and relies on an array (.length); a unique
-- constraint would make PostgREST return an object instead. NULLs stay distinct.
create unique index cash_collections_order_uidx on public.cash_collections (order_id);

-- Composite FK so a cash row can never point at another workspace's order.
-- ON DELETE SET NULL (order_id) nulls only order_id (workspace_id is NOT NULL). PG15+.
create unique index orders_id_workspace_uidx on public.orders (id, workspace_id);
alter table public.cash_collections drop constraint cash_collections_order_id_fkey;
alter table public.cash_collections
  add constraint cash_collections_order_ws_fkey
  foreign key (order_id, workspace_id) references public.orders (id, workspace_id)
  on delete set null (order_id);

create trigger audit after insert or update or delete on public.cash_collections
  for each row execute function public.audit_row();
