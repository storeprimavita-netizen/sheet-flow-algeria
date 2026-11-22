-- Ledger rows keep exact account amounts. USDT supports six fractional places,
-- DZD and the currencies of pending legacy accounts use two.
create table public.account_legacy_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legacy_account_id uuid not null,
  destination_id uuid not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array'),
  created_by uuid references auth.users(id),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, legacy_account_id) references public.accounts(workspace_id, id),
  foreign key (workspace_id, destination_id) references public.accounts(workspace_id, id)
);
create unique index account_legacy_mappings_active_idx
  on public.account_legacy_mappings (workspace_id, legacy_account_id) where superseded_at is null;
create index account_legacy_mappings_legacy_idx on public.account_legacy_mappings (workspace_id, legacy_account_id);
create index account_legacy_mappings_destination_idx on public.account_legacy_mappings (workspace_id, destination_id);

-- Source FKs use NO ACTION, so a workspace cascade may remove both ends in the same statement.
alter table public.expenses add constraint expenses_workspace_id_id_key unique (workspace_id, id);
alter table public.ad_spend_daily add constraint ad_spend_workspace_id_id_key unique (workspace_id, id);
alter table public.contacts add constraint contacts_workspace_id_id_key unique (workspace_id, id);
alter table public.options add constraint options_workspace_id_id_key unique (workspace_id, id);

create table public.account_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  occurred_on date not null check (isfinite(occurred_on)),
  direction text not null check (direction in ('in', 'out')),
  amount numeric not null check (amount > 0 and amount < 100000000000000 and amount = round(amount, 6)),
  category_id uuid,
  note text check (length(note) <= 2000),
  transfer_id uuid,
  fx_rate numeric check (fx_rate > 0 and fx_rate < 100000000 and fx_rate = round(fx_rate, 8)),
  reverses_entry_id uuid,
  expense_id uuid,
  ad_spend_id uuid,
  contact_id uuid,
  legacy_mapping_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, transfer_id, direction),
  unique (workspace_id, reverses_entry_id),
  unique (workspace_id, expense_id),
  unique (workspace_id, ad_spend_id),
  check (num_nonnulls(expense_id, ad_spend_id) <= 1),
  check (fx_rate is null or transfer_id is not null),
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id),
  foreign key (workspace_id, category_id) references public.options(workspace_id, id),
  foreign key (workspace_id, reverses_entry_id) references public.account_entries(workspace_id, id),
  foreign key (workspace_id, expense_id) references public.expenses(workspace_id, id),
  foreign key (workspace_id, ad_spend_id) references public.ad_spend_daily(workspace_id, id),
  foreign key (workspace_id, contact_id) references public.contacts(workspace_id, id),
  foreign key (workspace_id, legacy_mapping_id) references public.account_legacy_mappings(workspace_id, id)
);

create index account_entries_account_date_idx on public.account_entries (workspace_id, account_id, occurred_on desc);
create index account_entries_category_idx on public.account_entries (workspace_id, category_id) where category_id is not null;
create index account_entries_contact_idx on public.account_entries (workspace_id, contact_id) where contact_id is not null;
create index account_entries_mapping_idx on public.account_entries (workspace_id, legacy_mapping_id) where legacy_mapping_id is not null;

create table public.account_entry_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_key uuid not null,
  input jsonb not null,
  result uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, request_key)
);

do $$
declare
  v_table text;
begin
  foreach v_table in array array['account_entries', 'account_entry_requests', 'account_legacy_mappings'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('grant select on public.%I to authenticated', v_table);
    execute format('create policy admin_read on public.%I for select to authenticated
      using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', v_table);
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', v_table);
  end loop;
end;
$$;

create trigger audit_account_entries after insert on public.account_entries
  for each row execute function public.audit_row();
create trigger audit_account_entry_requests after insert on public.account_entry_requests
  for each row execute function public.audit_row();
create trigger audit_account_legacy_mappings after insert or update on public.account_legacy_mappings
  for each row execute function public.audit_row();
