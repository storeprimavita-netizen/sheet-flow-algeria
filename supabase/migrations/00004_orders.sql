-- ============================================================================
-- MNW COD ERP v2 — customers, suppliers, orders, status history, cash
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) customers  (auto-created from orders; keyed by normalized phone)
-- ---------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  phone        text not null,          -- normalized 0XXXXXXXXX (trigger enforces)
  phone_raw    text,                   -- as originally received
  wilaya_code  smallint references public.wilayas(code),
  commune      text,
  address      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, phone)
);

create or replace function public.customers_normalize_phone()
returns trigger language plpgsql as $$
begin
  new.phone_raw := coalesce(new.phone_raw, new.phone);
  new.phone := public.normalize_dz_phone(new.phone);
  return new;
end; $$;

create trigger customers_normalize before insert or update on public.customers
  for each row execute function public.customers_normalize_phone();

-- ---------------------------------------------------------------------------
-- 2) contacts  (suppliers / partners only — customers moved to their own table)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type         supplier_type not null,
  name         text not null,
  phones       text[] not null default '{}',
  location     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.expenses
  add constraint expenses_contact_fk
  foreign key (contact_id) references public.contacts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3) orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null references public.workspaces(id) on delete cascade,
  order_number                text,
  source                      order_source not null default 'manual',
  external_id                 text,
  webhook_event_id            uuid references public.webhook_events(id),
  product_id                  uuid references public.products(id),
  variant                     text,
  quantity                    integer not null default 1 check (quantity > 0),
  customer_id                 uuid references public.customers(id),
  -- snapshot of what the buyer entered (customer row may be edited later)
  customer_name               text,
  customer_phone              text,
  wilaya_code                 smallint references public.wilayas(code),
  commune                     text,
  address                     text,
  delivery_type               delivery_type not null default 'home',
  sale_price                  numeric(12,2),          -- per unit, DZD
  delivery_fee                numeric(12,2),          -- DZD; agents see, only admin edits
  delivery_fee_source         delivery_fee_source not null default 'manual',
  confirmation_status         confirmation_status not null default 'wait_for_confirmation',
  delivery_status             delivery_status not null default 'wait_for_deposit',
  confirmation_comment        text,
  confirmation_attempts       integer not null default 0,
  assigned_confirmation_agent uuid references auth.users(id),
  assigned_delivery_agent     uuid references auth.users(id),
  is_duplicate_suspect        boolean not null default false,
  duplicate_of                uuid references public.orders(id),
  placed_at                   timestamptz,
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (workspace_id, source, external_id)   -- webhook idempotency
);
create index orders_ws_conf_idx    on public.orders (workspace_id, confirmation_status);
create index orders_ws_deliv_idx   on public.orders (workspace_id, delivery_status);
create index orders_ws_product_idx on public.orders (workspace_id, product_id);
create index orders_customer_idx   on public.orders (customer_id);
create index orders_ws_wilaya_idx  on public.orders (workspace_id, wilaya_code);
create index orders_created_idx    on public.orders (workspace_id, created_at desc);

alter table public.stock_movements
  add constraint stock_movements_order_fk
  foreign key (order_id) references public.orders(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) order_status_history  (every transition, timestamped — drives agent
--    stats, time-to-confirm, and the audit requirement for status changes)
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  stage       text not null check (stage in ('confirmation','delivery')),
  from_status text,
  to_status   text not null,
  comment     text,
  actor       uuid,                    -- null = webhook/system
  created_at  timestamptz not null default now()
);
create index osh_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Order triggers
-- ---------------------------------------------------------------------------

-- a) column-level stage guard: agents only touch their own stage
create or replace function public.guard_order_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.current_app_role();
begin
  if auth.uid() is null then return new; end if;   -- service role (webhooks)
  if r is null then raise exception 'no active role for current user'; end if;
  if r = 'admin' then return new; end if;
  if r = 'confirmation_agent' and new.delivery_status is distinct from old.delivery_status then
    raise exception 'confirmation agents cannot change delivery_status';
  end if;
  if r = 'delivery_agent' and (new.confirmation_status is distinct from old.confirmation_status
                               or new.confirmation_comment is distinct from old.confirmation_comment) then
    raise exception 'delivery agents cannot change confirmation fields';
  end if;
  -- commercial fields are admin-only
  if new.sale_price   is distinct from old.sale_price
     or new.delivery_fee is distinct from old.delivery_fee
     or new.product_id   is distinct from old.product_id
     or new.quantity     is distinct from old.quantity then
    raise exception 'only admins can change price, fee, product, or quantity';
  end if;
  return new;
end; $$;

create trigger orders_guard_fields
  before update on public.orders
  for each row execute function public.guard_order_fields();

-- b) status history: initial statuses on insert + every transition on update
create or replace function public.log_order_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, stage, from_status, to_status, actor)
    values (new.id, 'confirmation', null, new.confirmation_status::text, auth.uid()),
           (new.id, 'delivery',     null, new.delivery_status::text,     auth.uid());
    return new;
  end if;
  if new.confirmation_status is distinct from old.confirmation_status then
    insert into public.order_status_history(order_id, stage, from_status, to_status, comment, actor)
    values (new.id, 'confirmation', old.confirmation_status::text,
            new.confirmation_status::text, new.confirmation_comment, auth.uid());
  end if;
  if new.delivery_status is distinct from old.delivery_status then
    insert into public.order_status_history(order_id, stage, from_status, to_status, actor)
    values (new.id, 'delivery', old.delivery_status::text,
            new.delivery_status::text, auth.uid());
  end if;
  return new;
end; $$;

create trigger orders_log_status
  after insert or update on public.orders
  for each row execute function public.log_order_status();

-- c) duplicate detection: same normalized phone + same product within the
--    workspace's duplicate window (settings key 'duplicate_window', default 48h)
create or replace function public.flag_duplicate_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hours int; v_dup uuid; v_phone text;
begin
  v_phone := public.normalize_dz_phone(new.customer_phone);
  if v_phone is null or new.product_id is null then return new; end if;
  select coalesce((value->>'hours')::int, 48) into v_hours
    from public.settings
    where workspace_id = new.workspace_id and key = 'duplicate_window';
  v_hours := coalesce(v_hours, 48);
  select o.id into v_dup
    from public.orders o
    where o.workspace_id = new.workspace_id
      and o.id <> new.id
      and o.product_id = new.product_id
      and public.normalize_dz_phone(o.customer_phone) = v_phone
      and o.created_at > now() - make_interval(hours => v_hours)
    order by o.created_at desc limit 1;
  if v_dup is not null then
    new.is_duplicate_suspect := true;
    new.duplicate_of := v_dup;
  end if;
  return new;
end; $$;

create trigger orders_flag_duplicate
  before insert on public.orders
  for each row execute function public.flag_duplicate_order();

-- d) stock side-effects: delivered ⇒ stock −qty; returned ⇒ stock +qty
create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is null then return new; end if;
  if new.delivery_status = 'delivered' and old.delivery_status <> 'delivered' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, -new.quantity, 'delivered', new.id, auth.uid());
  elsif new.delivery_status = 'returned' and old.delivery_status <> 'returned' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, new.quantity, 'returned', new.id, auth.uid());
  end if;
  return new;
end; $$;

create trigger orders_stock_effects
  after update on public.orders
  for each row execute function public.order_stock_effects();

-- ---------------------------------------------------------------------------
-- 5) cash_collections  (COD cash reconciliation — admin only)
-- ---------------------------------------------------------------------------
create table public.cash_collections (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  amount_dzd   numeric(12,2) not null check (amount_dzd >= 0),
  status       cash_status not null default 'collected',
  collected_on date not null default current_date,
  deposited_on date,
  reference    text,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index cash_ws_status_idx on public.cash_collections (workspace_id, status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','orders','cash_collections'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.contacts             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_status_history enable row level security;
alter table public.cash_collections     enable row level security;

-- customers: all roles read (history + risk shown while calling); admin writes.
create policy cu_sel on public.customers for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy cu_all on public.customers for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

-- contacts (suppliers): admin only (they carry sourcing relationships)
create policy co_adm on public.contacts for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

-- orders: admin all; confirmation agents see the pre-handoff pipeline;
-- delivery agents see confirmed orders. Stage guard trigger limits columns.
create policy o_sel on public.orders for select to authenticated using (
  workspace_id = public.current_workspace_id() and (
       public.is_admin()
    or (public.current_app_role() = 'confirmation_agent' and confirmation_status <> 'confirmed')
    or (public.current_app_role() = 'delivery_agent'     and confirmation_status = 'confirmed')
  ));
create policy o_ins on public.orders for insert to authenticated
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
create policy o_upd on public.orders for update to authenticated
  using (
    workspace_id = public.current_workspace_id() and (
         public.is_admin()
      or (public.current_app_role() = 'confirmation_agent' and confirmation_status <> 'confirmed')
      or (public.current_app_role() = 'delivery_agent'     and confirmation_status = 'confirmed')
    ))
  with check (
    workspace_id = public.current_workspace_id() and (
         public.is_admin()
      or public.current_app_role() = 'confirmation_agent'
      or (public.current_app_role() = 'delivery_agent' and confirmation_status = 'confirmed')
    ));
create policy o_del on public.orders for delete to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin());

-- history: visible with the parent order; rows written by definer trigger only
create policy osh_sel on public.order_status_history for select to authenticated using (
  exists(select 1 from public.orders o where o.id = order_status_history.order_id
         and o.workspace_id = public.current_workspace_id()));

-- cash: admin only
create policy cc_adm on public.cash_collections for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
