-- D97: plan first, then post the entire workspace or leave the old balances live.
alter table public.exchange_rates add constraint exchange_rates_usdt_finite_check
  check (currency <> 'USDT' or rate_dzd < 100000000);

alter table public.account_legacy_mappings add column previous_mapping_id uuid,
  add foreign key (workspace_id, previous_mapping_id) references public.account_legacy_mappings(workspace_id, id);
create unique index account_legacy_mappings_previous_idx
  on public.account_legacy_mappings (workspace_id, previous_mapping_id) where previous_mapping_id is not null;

create function private.default_legacy_account_kind(p_name text, p_currency public.currency_code)
returns text language sql immutable set search_path = '' as $$
  select case when num_nonnulls(zr, dzd, usdt) = 1 then coalesce(zr, dzd, usdt) end
  from (select
    case when lower(p_name) ~ '(^|[^a-z0-9])(zr|courier|carrier|zrexpress)([^a-z0-9]|$)|شركة التوصيل' then 'zr' end as zr,
    case when p_currency = 'DZD' and lower(p_name) ~ '(^|[^a-z0-9])(cash|bank|dzd|dinar|banque|caisse)([^a-z0-9]|$)|بنك|دينار|صندوق' then 'dzd' end as dzd,
    case when lower(p_name) ~ '(^|[^a-z0-9])(crypto|binance|usdt)([^a-z0-9]|$)|بينانس' then 'usdt' end as usdt
  ) hints;
$$;

create view private.legacy_money_sources as
select 'opening'::text as source_type, a.id as source_id, a.id as account_id,
  a.workspace_id, a.opening_balance as amount, a.currency,
  (a.created_at at time zone 'Africa/Algiers')::date as occurred_on,
  case when a.opening_balance < 0 then 'out' else 'in' end as direction,
  null::numeric as fx_rate, null::numeric as amount_dzd
from public.accounts a where a.kind is null
union all
select 'topup', t.id, t.account_id, t.workspace_id, t.amount, a.currency,
  t.occurred_on, 'in', null, null
from public.account_topups t join public.accounts a on a.id = t.account_id
union all
select 'entry', l.id, l.account_id, l.workspace_id, l.amount, a.currency,
  l.occurred_on, l.direction, null, null
from public.account_entries l join public.accounts a on a.id = l.account_id
where a.kind is null and l.legacy_mapping_id is null
union all
select 'expense', id, account_id, workspace_id, amount, currency, spent_on, 'out', fx_rate, amount_dzd
from public.expenses where account_id is not null
union all
select 'ad_spend', id, account_id, workspace_id, amount, currency, spent_on, 'out', fx_rate, amount_dzd
from public.ad_spend_daily where account_id is not null;

create function private.legacy_mapping_plan(
  p_workspace uuid,
  p_legacy_id uuid,
  p_destination_currency public.currency_code,
  p_conversions jsonb,
  p_previous public.account_legacy_mappings
)
returns jsonb language sql stable set search_path = '' as $$
  with sources as (
    select s.*, s.source_type || ':' || s.source_id::text as source_key,
      case
        when s.source_type not in ('expense', 'ad_spend') then false
        when s.source_type = 'expense' then exists (
          select 1 from public.account_entries e where e.workspace_id = p_workspace
            and e.expense_id = s.source_id and e.legacy_mapping_id is null)
        else exists (
          select 1 from public.account_entries e where e.workspace_id = p_workspace
            and e.ad_spend_id = s.source_id and e.legacy_mapping_id is null)
      end as direct_debit_posting,
      case when p_destination_currency is not null
        and s.amount > -100000000000000 and s.amount < 100000000000000
        and isfinite(s.occurred_on) then
        case
          when s.currency = p_destination_currency then abs(s.amount)
          when s.amount = 0 and (s.source_type not in ('expense', 'ad_spend') or s.amount_dzd = 0) then 0
          when s.source_type in ('expense', 'ad_spend') and p_destination_currency = 'DZD'
            and s.fx_rate > 0 and s.fx_rate < 100000000
            and s.amount_dzd >= 0 and s.amount_dzd < 100000000000000 then s.amount_dzd
        end
      end as exact_amount
    from private.legacy_money_sources s
    where s.workspace_id = p_workspace and (
      s.account_id = p_legacy_id
      or (s.source_type in ('expense', 'ad_spend') and s.account_id = (p_previous).destination_id
        and (p_previous).evidence @> jsonb_build_array(jsonb_build_object(
          'source_type', s.source_type, 'source_id', s.source_id)))
    )
  ), resolved as (
    select *,
      case when exact_amount is null and p_destination_currency is not null
        and amount <> 0 and amount > -100000000000000 and amount < 100000000000000 and isfinite(occurred_on)
        and jsonb_typeof(p_conversions -> source_key -> 'amount') = 'number'
        and jsonb_typeof(p_conversions -> source_key -> 'evidence') = 'string'
        and length(btrim(p_conversions -> source_key ->> 'evidence')) between 1 and 2000
        and private.ledger_amount_valid(case when jsonb_typeof(p_conversions -> source_key -> 'amount') = 'number'
          then (p_conversions -> source_key ->> 'amount')::numeric end, p_destination_currency)
      then (p_conversions -> source_key ->> 'amount')::numeric end as converted_amount
    from sources
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_key', source_key, 'source_type', source_type, 'source_id', source_id,
    'amount', amount, 'currency', currency, 'occurred_on', occurred_on, 'direction', direction,
    'fx_rate', fx_rate, 'amount_dzd', amount_dzd, 'target_amount', coalesce(exact_amount, converted_amount),
    'conversion_evidence', case when converted_amount is not null then btrim(p_conversions -> source_key ->> 'evidence') end,
    'uses_ledger_debit', converted_amount is not null and source_type in ('expense', 'ad_spend'),
    'direct_debit_posting', direct_debit_posting
  ) order by source_key), '[]'::jsonb) from resolved;
$$;

create function private.legacy_has_invalid_links(p_workspace uuid, p_legacy_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from private.legacy_money_sources
    where account_id = p_legacy_id and workspace_id <> p_workspace);
$$;

create function public.preview_legacy_accounts()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_workspace uuid := private.ledger_workspace();
  v_preview jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'account_id', a.id, 'name', a.name, 'currency', a.currency, 'opening_balance', a.opening_balance,
    'balance', b.balance, 'posted', a.legacy_posted,
    'previous_mapping_id', m.id, 'previous_kind', d.kind, 'previous_evidence', m.evidence,
    'proposed_kind', choice.kind,
    'invalid_links', private.legacy_has_invalid_links(v_workspace, a.id),
    'sources', private.legacy_mapping_plan(v_workspace, a.id,
      case choice.kind when 'usdt' then 'USDT'::public.currency_code
        when 'dzd' then 'DZD'::public.currency_code when 'zr' then 'DZD'::public.currency_code end,
      '{}'::jsonb, m)
  ) order by a.created_at, a.id), '[]'::jsonb)
  into v_preview from public.accounts a
  left join public.account_balances b on b.workspace_id = a.workspace_id and b.account_id = a.id
  left join public.account_legacy_mappings m on m.workspace_id = a.workspace_id
    and m.legacy_account_id = a.id and m.superseded_at is null
  left join public.accounts d on d.workspace_id = a.workspace_id and d.id = m.destination_id
  cross join lateral (select coalesce(d.kind, private.default_legacy_account_kind(a.name, a.currency)) as kind) choice
  where a.workspace_id = v_workspace and a.kind is null;
  return v_preview;
end;
$$;

create function private.apply_legacy_mapping(
  p_workspace uuid,
  p_legacy_id uuid,
  p_destination uuid,
  p_evidence jsonb,
  p_previous public.account_legacy_mappings
)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_mapping uuid;
  v_source jsonb;
  v_source_id uuid;
  v_source_type text;
  v_expense uuid;
  v_ad_spend uuid;
  v_amount numeric;
  v_known_debit boolean;
begin
  if p_previous.id is not null then
    update public.account_legacy_mappings set superseded_at = now()
    where workspace_id = p_workspace and id = p_previous.id;
  end if;

  insert into public.account_legacy_mappings (
    workspace_id, legacy_account_id, destination_id, previous_mapping_id, evidence, created_by
  ) values (p_workspace, p_legacy_id, p_destination, p_previous.id, p_evidence, auth.uid())
  returning id into v_mapping;

  if p_previous.id is not null then
    insert into public.account_entries (workspace_id, account_id, occurred_on, direction,
      amount, reverses_entry_id, legacy_mapping_id, created_by)
    select workspace_id, account_id, occurred_on, case direction when 'in' then 'out' else 'in' end,
      amount, id, v_mapping, auth.uid()
    from public.account_entries
    where workspace_id = p_workspace and legacy_mapping_id = p_previous.id and reverses_entry_id is null;
  end if;

  for v_source in select value from jsonb_array_elements(p_evidence) loop
    v_source_id := (v_source ->> 'source_id')::uuid;
    v_source_type := v_source ->> 'source_type';
    v_amount := (v_source ->> 'target_amount')::numeric;
    v_expense := case when v_source_type = 'expense' then v_source_id end;
    v_ad_spend := case when v_source_type = 'ad_spend' then v_source_id end;
    select exists (select 1 from public.account_entries l
      where l.workspace_id = p_workspace and (l.expense_id = v_expense or l.ad_spend_id = v_ad_spend))
    into v_known_debit;

    if v_amount > 0 and (v_source_type not in ('expense', 'ad_spend')
      or (v_source ->> 'uses_ledger_debit')::boolean or v_known_debit) then
      insert into public.account_entries (workspace_id, account_id, occurred_on, direction,
        amount, expense_id, ad_spend_id, legacy_mapping_id, created_by)
      values (p_workspace, p_destination, (v_source ->> 'occurred_on')::date, v_source ->> 'direction',
        v_amount, case when not v_known_debit then v_expense end,
        case when not v_known_debit then v_ad_spend end, v_mapping, auth.uid());
    end if;

    if v_expense is not null then
      update public.expenses set account_id = p_destination
      where workspace_id = p_workspace and id = v_expense;
    elsif v_ad_spend is not null then
      update public.ad_spend_daily set account_id = p_destination
      where workspace_id = p_workspace and id = v_ad_spend;
    end if;
  end loop;
  update public.accounts set legacy_posted = true
  where workspace_id = p_workspace and id = p_legacy_id and not legacy_posted;
  return v_mapping;
end;
$$;

create function private.validate_legacy_plan(p_plan jsonb, p_conversions jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_array_elements(p_plan) e
    where e ->> 'target_amount' is null or (e ->> 'direct_debit_posting')::boolean
  ) and not exists (
    select 1 from jsonb_object_keys(p_conversions) c(key)
    where not exists (
      select 1 from jsonb_array_elements(p_plan) e
      where e ->> 'source_key' = c.key and e ->> 'conversion_evidence' is not null
    )
  );
$$;

-- Lock source rows before reading the inputs. Account row locks also serialize
-- debit inserts that start after this point, via the existing write guard.
create function private.lock_legacy_sources(p_workspace uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform private.lock_ledger(p_workspace);
  perform 1 from public.accounts where workspace_id = p_workspace order by id for update;
  perform 1 from public.expenses where workspace_id = p_workspace and account_id is not null order by id for update;
  perform 1 from public.ad_spend_daily where workspace_id = p_workspace and account_id is not null order by id for update;
  perform 1 from public.account_topups where workspace_id = p_workspace order by id for share;
end;
$$;

create function private.post_legacy_workspace(p_workspace uuid, p_mappings jsonb, p_automatic boolean)
returns uuid[] language plpgsql set search_path = '' as $$
declare
  v_account public.accounts;
  v_destination public.accounts;
  v_input jsonb;
  v_conversions jsonb;
  v_plan jsonb;
  v_kind text;
  v_plans jsonb := '[]'::jsonb;
  v_posting jsonb;
  v_result uuid[] := '{}';
begin
  if jsonb_typeof(p_mappings) is distinct from 'object' then
    raise exception 'Expected a mapping object keyed by legacy account ID' using errcode = '22023';
  end if;
  perform private.lock_legacy_sources(p_workspace);

  if exists (select 1 from jsonb_object_keys(p_mappings) m(key)
    where not exists (select 1 from public.accounts a where a.workspace_id = p_workspace
      and a.kind is null and not a.legacy_posted and a.id::text = m.key)) then
    raise exception 'Mapping includes an unavailable legacy account' using errcode = '22023';
  end if;

  for v_account in select * from public.accounts
    where workspace_id = p_workspace and kind is null and not legacy_posted order by id
  loop
    v_input := p_mappings -> v_account.id::text;
    v_conversions := coalesce(v_input -> 'conversions', '{}'::jsonb);
    if (v_input is not null and jsonb_typeof(v_input) <> 'object')
      or jsonb_typeof(v_conversions) <> 'object'
      or (v_input ? 'kind' and jsonb_typeof(v_input -> 'kind') <> 'string') then
      raise exception 'Invalid legacy account mapping input' using errcode = '22023';
    end if;

    v_kind := coalesce(v_input ->> 'kind', private.default_legacy_account_kind(v_account.name, v_account.currency));
    select * into v_destination from public.accounts where workspace_id = p_workspace and kind = v_kind;
    v_plan := private.legacy_mapping_plan(p_workspace, v_account.id, v_destination.currency, v_conversions, null);
    if v_destination.id is null or private.legacy_has_invalid_links(p_workspace, v_account.id)
      or not private.validate_legacy_plan(v_plan, v_conversions) then
      if p_automatic then return '{}'; end if;
      raise exception 'Resolve every legacy account and conversion before posting' using errcode = '22023';
    end if;

    v_plans := v_plans || jsonb_build_array(jsonb_build_object(
      'legacy_id', v_account.id, 'destination_id', v_destination.id, 'evidence', v_plan));
  end loop;

  for v_posting in select value from jsonb_array_elements(v_plans) loop
    v_result := array_append(v_result, private.apply_legacy_mapping(p_workspace,
      (v_posting ->> 'legacy_id')::uuid, (v_posting ->> 'destination_id')::uuid, v_posting -> 'evidence', null));
  end loop;
  return v_result;
end;
$$;

create function public.post_legacy_accounts(p_mappings jsonb default '{}'::jsonb)
returns uuid[] language sql security definer set search_path = pg_catalog, pg_temp as $$
  select private.post_legacy_workspace(private.ledger_workspace(), p_mappings, false);
$$;

create function public.remap_legacy_account(
  p_legacy_account_id uuid,
  p_expected_mapping_id uuid,
  p_kind text,
  p_conversions jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_workspace uuid := private.ledger_workspace();
  v_previous public.account_legacy_mappings;
  v_destination public.accounts;
  v_plan jsonb;
begin
  if jsonb_typeof(p_conversions) is distinct from 'object' then
    raise exception 'Expected a conversion object keyed by source' using errcode = '22023';
  end if;
  perform private.lock_legacy_sources(v_workspace);
  select * into v_previous from public.account_legacy_mappings
  where workspace_id = v_workspace and legacy_account_id = p_legacy_account_id and superseded_at is null;
  select * into v_destination from public.accounts where workspace_id = v_workspace and kind = p_kind;
  if v_previous.id is null or v_previous.id is distinct from p_expected_mapping_id or v_destination.id is null
    or v_previous.destination_id = v_destination.id then
    raise exception 'Choose a different destination using the current legacy mapping' using errcode = '22023';
  end if;

  v_plan := private.legacy_mapping_plan(v_workspace, p_legacy_account_id, v_destination.currency, p_conversions, v_previous);
  if not private.validate_legacy_plan(v_plan, p_conversions) then
    raise exception 'Resolve the legacy debit or conversion before remapping' using errcode = '22023';
  end if;
  return private.apply_legacy_mapping(v_workspace, p_legacy_account_id, v_destination.id, v_plan, v_previous);
end;
$$;

revoke all on function private.default_legacy_account_kind(text, public.currency_code),
  private.legacy_mapping_plan(uuid, uuid, public.currency_code, jsonb, public.account_legacy_mappings),
  private.legacy_has_invalid_links(uuid, uuid),
  private.apply_legacy_mapping(uuid, uuid, uuid, jsonb, public.account_legacy_mappings),
  private.validate_legacy_plan(jsonb, jsonb), private.lock_legacy_sources(uuid),
  private.post_legacy_workspace(uuid, jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.preview_legacy_accounts(), public.post_legacy_accounts(jsonb),
  public.remap_legacy_account(uuid, uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.preview_legacy_accounts(), public.post_legacy_accounts(jsonb),
  public.remap_legacy_account(uuid, uuid, text, jsonb) to authenticated;

do $$
declare
  v_workspace uuid;
begin
  for v_workspace in select distinct workspace_id from public.accounts where kind is null loop
    perform private.post_legacy_workspace(v_workspace, '{}'::jsonb, true);
  end loop;
end;
$$;
