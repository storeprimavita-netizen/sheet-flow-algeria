-- D39 / D97: keep the original accounts available until their mapping posts.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.exchange_rates
  drop constraint exchange_rates_currency_check,
  add constraint exchange_rates_currency_check check (currency in ('USD', 'EUR', 'USDT'));

-- The fixed-fee form keeps the same currency choices after the enum expands.
alter table public.fixed_fees add constraint fixed_fees_currency_check
  check (currency in ('DZD', 'USD', 'EUR'));

alter table public.accounts
  add column kind text,
  add column legacy_posted boolean not null default false,
  add constraint accounts_workspace_id_id_key unique (workspace_id, id),
  add constraint accounts_workspace_kind_key unique (workspace_id, kind),
  add constraint accounts_kind_currency_check check (
    kind is null
    or (not legacy_posted and opening_balance = 0
      and ((kind in ('zr', 'dzd') and currency = 'DZD') or (kind = 'usdt' and currency = 'USDT')))
  );

drop policy accts_adm on public.accounts;
create policy accounts_admin_read on public.accounts for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()) and not legacy_posted);
create policy accounts_admin_settings on public.accounts for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()) and not legacy_posted)
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()) and not legacy_posted);
revoke all on public.accounts from public, anon, authenticated;
grant select, update (name, low_balance_threshold, is_active) on public.accounts to authenticated;

drop policy topups_adm on public.account_topups;
create policy account_topups_admin_read on public.account_topups for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
revoke all on public.account_topups from public, anon, authenticated;
grant select on public.account_topups to authenticated;

-- Keep options usable for regular workflows while shielding the finance set.
create policy option_sets_money_admin on public.option_sets as restrictive for all to authenticated
  using (key <> 'money_category' or (select public.is_admin()))
  with check (key <> 'money_category' or (select public.is_admin()));
create policy options_money_admin on public.options as restrictive for all to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.option_sets s where s.id = set_id and s.workspace_id = options.workspace_id
  ))
  with check ((select public.is_admin()) or exists (
    select 1 from public.option_sets s where s.id = set_id and s.workspace_id = options.workspace_id
  ));

create function private.seed_ledger_accounts(p_workspace uuid)
returns void language plpgsql set search_path = '' as $$
declare
  v_set uuid;
begin
  insert into public.accounts (workspace_id, kind, name, currency)
  values (p_workspace, 'zr', 'ZR', 'DZD'),
         (p_workspace, 'dzd', 'DZD', 'DZD'),
         (p_workspace, 'usdt', 'USDT', 'USDT')
  on conflict (workspace_id, kind) do nothing;

  insert into public.option_sets (workspace_id, key, label)
  values (p_workspace, 'money_category', 'Money category')
  on conflict (workspace_id, key) do nothing;

  select id into v_set from public.option_sets
  where workspace_id = p_workspace and key = 'money_category';

  insert into public.options (workspace_id, set_id, label, sort_order)
  select p_workspace, v_set, seeded.label, seeded.sort_order::integer
  from unnest(array['Stock purchase','Ads top-up','Salary','Courier payout',
    'Owner withdrawal','Transfer','Other']) with ordinality as seeded(label, sort_order)
  where not exists (
    select 1 from public.options o
    where o.workspace_id = p_workspace and o.set_id = v_set
      and lower(btrim(o.label)) = lower(seeded.label)
  );
end;
$$;

create function private.seed_ledger_for_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_ledger_accounts(new.id);
  return new;
end;
$$;

revoke all on function private.seed_ledger_accounts(uuid), private.seed_ledger_for_workspace()
  from public, anon, authenticated, service_role;
create trigger workspaces_seed_ledger after insert on public.workspaces
  for each row execute function private.seed_ledger_for_workspace();
select private.seed_ledger_accounts(id) from public.workspaces;
