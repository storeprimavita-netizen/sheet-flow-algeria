-- ============================================================================
-- MNW COD ERP — initial schema
-- File: supabase/migrations/00001_init.sql
--
-- Apply via:  Supabase Dashboard → SQL Editor → paste & run
--   (or:  supabase db push  with the CLI installed)
--
-- After applying:
--   1) Create your first auth user (Dashboard → Authentication → Users → Add user,
--      or sign up once at /login).
--   2) Bootstrap that user as admin (works exactly once — refuses after an admin exists):
--        select public.bootstrap_admin('you@mnw.xxx');
--   3) Regenerate TypeScript types into the Next app:
--        npx supabase gen types --project-id <id> > src/integrations/supabase/types.ts
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type app_role            as enum ('admin','confirmation_agent','delivery_agent');
create type product_status      as enum ('to_be_tested','tested','confirmed','cancelled');
create type confirmation_status as enum ('wait_for_confirmation','not_answer','closed_phone','cancelled','confirmed');
create type delivery_status     as enum ('wait_for_deposit','bureau_deposited','in_transit','out_for_delivery','stop_desk_waiting','delivered','cancelled','delayed','returning','returned');
create type contact_type        as enum ('shooting_studio','atelier_couture','emballage','customer','supplier');
create type expense_category    as enum ('shooting','packaging','sampling','confirmation','delivery','test_ads','scaling_ads','other');

-- ---------------------------------------------------------------------------
-- 1) user_roles  (RBAC — drives every policy)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       app_role not null default 'confirmation_agent',
  created_at timestamptz not null default now()
);

-- RBAC helpers (security definer → bypass RLS, no recursion). Defined after user_roles.
create or replace function public.current_user_role()
returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- new signups default to confirmation_agent (no auto-admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'confirmation_agent');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- delegation guard: any user may assign agent roles; only admin may assign/remove 'admin'.
-- (allows the FIRST admin when none exists yet, so bootstrap_admin can run.)
create or replace function public.guard_user_roles()
returns trigger
language plpgsql security definer set search_path = public as $$
declare admin_exists boolean;
begin
  select exists(select 1 from public.user_roles where role = 'admin') into admin_exists;
  if tg_op in ('INSERT','UPDATE') and new.role = 'admin'
     and not (public.is_admin() or not admin_exists) then
    raise exception 'only admins can assign the admin role';
  end if;
  if tg_op = 'DELETE' and old.role = 'admin' and not public.is_admin() then
    raise exception 'only admins can remove an admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

create trigger user_roles_guard
  before insert or update or delete on public.user_roles
  for each row execute function public.guard_user_roles();

-- one-shot bootstrap (refuses once an admin exists)
create or replace function public.bootstrap_admin(p_email text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; n int;
begin
  select count(*) into n from public.user_roles where role = 'admin';
  if n > 0 then
    raise exception 'an admin already exists; ask an admin to promote this user instead';
  end if;
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then
    raise exception 'auth user with email % not found', p_email;
  end if;
  -- ON CONFLICT: handle_new_user already inserted a confirmation_agent row
  -- when the auth user was created.
  insert into public.user_roles(user_id, role) values (v_uid, 'admin')
  on conflict (user_id) do update set role = 'admin';
  return v_uid;
end; $$;

-- ---------------------------------------------------------------------------
-- 2) products
-- ---------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  sku               text unique,
  name              text not null,
  description       text,
  category          text,
  material          text,
  fabric            text,
  status            product_status not null default 'to_be_tested',
  cost_shooting     numeric(12,2) not null default 0,
  cost_packaging    numeric(12,2) not null default 0,
  cost_sampling     numeric(12,2) not null default 0,
  cost_confirmation numeric(12,2) not null default 0,
  cost_delivery     numeric(12,2) not null default 0,
  cost_test_ads     numeric(12,2) not null default 0,
  cost_scaling_ads  numeric(12,2) not null default 0,
  selling_price     numeric(12,2),
  image_url         text,
  is_active         boolean not null default true,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) contacts  (global address book + customers)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  city       text,
  location   text,
  type       contact_type not null,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contacts_phone_uniq on public.contacts(phone) where phone is not null;

-- ---------------------------------------------------------------------------
-- 4) orders  (relational to products + customers; manual logistics)
-- ---------------------------------------------------------------------------
create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  order_number                text unique,
  product_id                  uuid references public.products(id),
  customer_id                 uuid references public.contacts(id),
  quantity                    int not null default 1 check (quantity > 0),
  unit_price                  numeric(12,2),
  total_amount                numeric(12,2) generated always as (quantity * coalesce(unit_price,0)) stored,
  source                      text not null default 'manual',
  external_id                 text,
  confirmation_status         confirmation_status not null default 'wait_for_confirmation',
  delivery_status             delivery_status not null default 'wait_for_deposit',
  agent_comment               text,
  assigned_confirmation_agent uuid references auth.users(id),
  assigned_delivery_agent     uuid references auth.users(id),
  city                        text,
  address                     text,
  raw_payload                 jsonb,
  placed_at                   timestamptz,
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (source, external_id)
);

-- column-level stage guard: agents only touch their own stage's status
create or replace function public.guard_order_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.current_user_role();
begin
  if r is null then raise exception 'no role assigned to current user'; end if;
  if r = 'admin' then return new; end if;
  if r = 'confirmation_agent' and new.delivery_status is distinct from old.delivery_status then
    raise exception 'confirmation agents cannot change delivery_status';
  end if;
  if r = 'delivery_agent' and new.confirmation_status is distinct from old.confirmation_status then
    raise exception 'delivery agents cannot change confirmation_status';
  end if;
  return new;
end; $$;

create trigger orders_guard_fields
  before update on public.orders
  for each row execute function public.guard_order_fields();

-- ---------------------------------------------------------------------------
-- 5) order_events  (granular status history + agent comments)
-- ---------------------------------------------------------------------------
create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  stage      text not null check (stage in ('confirmation','delivery')),
  status     text not null,
  comment    text,
  actor      uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6) expenses  (granular costs linked to products)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  category    expense_category not null,
  amount      numeric(12,2) not null check (amount >= 0),
  incurred_on date not null default now()::date,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7) team_roles  (duties + Slack + meeting-lateness cache)
-- ---------------------------------------------------------------------------
create table public.team_roles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  duty                 text,
  slack_user_id        text,
  slack_channel_id     text,
  meeting_late_minutes int not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['products','contacts','orders','team_roles'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index orders_confirmation_status_idx on public.orders (confirmation_status);
create index orders_delivery_status_idx     on public.orders (delivery_status);
create index orders_customer_id_idx         on public.orders (customer_id);
create index orders_product_id_idx          on public.orders (product_id);
create index orders_conf_agent_idx          on public.orders (assigned_confirmation_agent);
create index orders_deliv_agent_idx         on public.orders (assigned_delivery_agent);
create index products_status_idx            on public.products (status);
create index products_category_idx          on public.products (category);
create index expenses_product_id_idx        on public.expenses (product_id);
create index order_events_order_id_idx      on public.order_events (order_id);

-- ---------------------------------------------------------------------------
-- customer reliability view (computed — no sync)
-- ---------------------------------------------------------------------------
create view public.customer_profiles as
select c.id, c.name, c.phone, c.city,
       count(*) filter (where o.confirmation_status = 'confirmed') as confirmed_orders,
       count(*) filter (where o.delivery_status     = 'delivered') as delivered_orders,
       count(*)                                                     as total_orders,
       case when count(*) filter (where o.confirmation_status = 'confirmed') = 0 then null
            else count(*) filter (where o.delivery_status = 'delivered')::numeric
               / count(*) filter (where o.confirmation_status = 'confirmed')
       end as reliability_score
from public.contacts c
left join public.orders o on o.customer_id = c.id
where c.type = 'customer'
group by c.id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.user_roles   enable row level security;
alter table public.team_roles   enable row level security;
alter table public.products     enable row level security;
alter table public.contacts     enable row level security;
alter table public.expenses     enable row level security;
alter table public.orders       enable row level security;
alter table public.order_events enable row level security;

-- user_roles: all authenticated read + manage agents (trigger gates 'admin')
create policy ur_sel on public.user_roles for select to authenticated using (true);
create policy ur_ins on public.user_roles for insert to authenticated with check (true);
create policy ur_upd on public.user_roles for update to authenticated using (true) with check (true);
create policy ur_del on public.user_roles for delete to authenticated using (true);

-- team_roles: self + admin
create policy tr_sel on public.team_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy tr_ins on public.team_roles for insert to authenticated with check (public.is_admin());
create policy tr_upd on public.team_roles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy tr_del on public.team_roles for delete to authenticated using (public.is_admin());

-- products: all read, admin writes
create policy p_sel on public.products for select to authenticated using (true);
create policy p_ins on public.products for insert to authenticated with check (public.is_admin());
create policy p_upd on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p_del on public.products for delete to authenticated using (public.is_admin());

-- contacts: all read (agents need customer phone/address), admin writes
create policy c_sel on public.contacts for select to authenticated using (true);
create policy c_ins on public.contacts for insert to authenticated with check (public.is_admin());
create policy c_upd on public.contacts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy c_del on public.contacts for delete to authenticated using (public.is_admin());

-- expenses: ALL USERS
create policy e_sel on public.expenses for select to authenticated using (true);
create policy e_ins on public.expenses for insert to authenticated with check (true);
create policy e_upd on public.expenses for update to authenticated using (true) with check (true);
create policy e_del on public.expenses for delete to authenticated using (true);

-- orders: confirmation queue (≠ confirmed) vs confirmed handoff
create policy o_sel on public.orders for select to authenticated using (
    public.is_admin()
 or (public.current_user_role() = 'confirmation_agent' and confirmation_status <> 'confirmed')
 or (public.current_user_role() = 'delivery_agent'     and confirmation_status = 'confirmed')
);
create policy o_ins on public.orders for insert to authenticated with check (public.is_admin());
create policy o_upd on public.orders for update to authenticated
  using (
      public.is_admin()
   or (public.current_user_role() = 'confirmation_agent' and confirmation_status <> 'confirmed')
   or (public.current_user_role() = 'delivery_agent'     and confirmation_status = 'confirmed')
  )
  with check (
      public.is_admin()
   or public.current_user_role() = 'confirmation_agent'
   or (public.current_user_role() = 'delivery_agent' and confirmation_status = 'confirmed')
  );
create policy o_del on public.orders for delete to authenticated using (public.is_admin());

-- order_events: follow parent order visibility; agents may log events
create policy oe_sel on public.order_events for select to authenticated using (
  exists(select 1 from public.orders o where o.id = order_events.order_id and (
        public.is_admin()
     or (public.current_user_role() = 'confirmation_agent' and o.confirmation_status <> 'confirmed')
     or (public.current_user_role() = 'delivery_agent'     and o.confirmation_status = 'confirmed')
  )));
create policy oe_ins on public.order_events for insert to authenticated with check (
  exists(select 1 from public.orders o where o.id = order_events.order_id));

-- ============================================================================
-- done. Next: bootstrap the first admin (see file header).
-- ============================================================================
