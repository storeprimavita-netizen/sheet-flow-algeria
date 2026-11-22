-- All writes to the ledger serialize within one workspace. Look up replay
-- keys under that same lock so a request and its effects commit together.
create function private.lock_ledger(p_workspace uuid)
returns void language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('mnw:account-ledger:' || p_workspace::text, 0));
$$;

create function private.ledger_workspace()
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v_workspace uuid := public.current_workspace_id();
begin
  if v_workspace is null or auth.uid() is null or not public.is_admin() then
    raise exception 'An active workspace admin is required' using errcode = '42501';
  end if;
  return v_workspace;
end;
$$;

create function private.ledger_amount_valid(p_amount numeric, p_currency public.currency_code)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_amount > 0 and p_amount < 100000000000000
    and p_amount = round(p_amount, case when p_currency = 'USDT' then 6 else 2 end), false);
$$;

create function private.ledger_replay(p_workspace uuid, p_request uuid, p_input jsonb)
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v_request public.account_entry_requests;
begin
  select * into v_request from public.account_entry_requests
  where workspace_id = p_workspace and request_key = p_request;
  if found and v_request.input <> p_input then
    raise exception 'This request key is already used for different ledger input' using errcode = '22023';
  end if;
  return v_request.result;
end;
$$;

create function private.record_ledger_request(p_workspace uuid, p_request uuid, p_input jsonb, p_result uuid)
returns void language sql set search_path = '' as $$
  insert into public.account_entry_requests (workspace_id, request_key, input, result)
  values (p_workspace, p_request, p_input, p_result);
$$;

create function private.ledger_account(p_workspace uuid, p_account uuid)
returns public.accounts language plpgsql set search_path = '' as $$
declare
  v_account public.accounts;
begin
  select * into v_account from public.accounts
  where workspace_id = p_workspace and id = p_account and not legacy_posted
  for share;
  if not found then
    raise exception 'Account is unavailable in this workspace' using errcode = '22023';
  end if;
  return v_account;
end;
$$;

create function public.append_account_entry(
  p_account_id uuid,
  p_occurred_on date,
  p_direction text,
  p_amount numeric,
  p_request_key uuid default null,
  p_category_id uuid default null,
  p_note text default null,
  p_expense_id uuid default null,
  p_ad_spend_id uuid default null,
  p_contact_id uuid default null
)
returns uuid language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_workspace uuid := private.ledger_workspace();
  v_request uuid := coalesce(p_request_key, gen_random_uuid());
  v_note text := nullif(btrim(p_note), '');
  v_input jsonb := jsonb_build_array('append', p_account_id, p_occurred_on, p_direction,
    p_amount, p_category_id, v_note, p_expense_id, p_ad_spend_id, p_contact_id);
  v_result uuid;
  v_account public.accounts;
  v_debit numeric;
begin
  perform private.lock_ledger(v_workspace);
  v_result := private.ledger_replay(v_workspace, v_request, v_input);
  if v_result is not null then
    return v_result;
  end if;

  v_account := private.ledger_account(v_workspace, p_account_id);
  if not private.ledger_amount_valid(p_amount, v_account.currency)
    or p_occurred_on is null or not isfinite(p_occurred_on)
    or p_direction is null or p_direction not in ('in', 'out')
    or num_nonnulls(p_expense_id, p_ad_spend_id) > 1 then
    raise exception 'Invalid movement amount, direction, date or source' using errcode = '22023';
  end if;

  if p_category_id is not null then
    perform 1 from public.options o
    join public.option_sets s on s.id = o.set_id and s.workspace_id = o.workspace_id
    where o.workspace_id = v_workspace and o.id = p_category_id
      and s.key = 'money_category' and o.archived_at is null
    for share of o, s;
    if not found then
      raise exception 'Invalid money category' using errcode = '22023';
    end if;
  end if;

  if p_expense_id is not null then
    select case when e.currency = v_account.currency then e.amount
           when v_account.currency = 'DZD' and e.fx_rate > 0 and e.fx_rate < 100000000
             and e.fx_rate <> 1 then e.amount_dzd end
    into v_debit from public.expenses e
    where e.workspace_id = v_workspace and e.id = p_expense_id and e.account_id = p_account_id
    for update;
  elsif p_ad_spend_id is not null then
    select case when s.currency = v_account.currency then s.amount
           when v_account.currency = 'DZD' and s.fx_rate > 0 and s.fx_rate < 100000000
             and s.fx_rate <> 1 then s.amount_dzd end
    into v_debit from public.ad_spend_daily s
    where s.workspace_id = v_workspace and s.id = p_ad_spend_id and s.account_id = p_account_id
    for update;
  end if;

  if coalesce(p_expense_id, p_ad_spend_id) is not null
    and (v_account.kind is null or p_direction <> 'out' or p_amount is distinct from v_debit) then
    raise exception 'The linked debit must match the system account and amount' using errcode = '22023';
  end if;

  insert into public.account_entries (workspace_id, account_id, occurred_on, direction,
    amount, category_id, note, expense_id, ad_spend_id, contact_id, created_by)
  values (v_workspace, p_account_id, p_occurred_on, p_direction, p_amount,
    p_category_id, v_note, p_expense_id, p_ad_spend_id, p_contact_id, auth.uid())
  returning id into v_result;
  perform private.record_ledger_request(v_workspace, v_request, v_input, v_result);
  return v_result;
end;
$$;

create function public.transfer_account_funds(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_occurred_on date,
  p_amount_out numeric,
  p_amount_in numeric,
  p_request_key uuid,
  p_rate_dzd numeric default null,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_workspace uuid := private.ledger_workspace();
  v_note text := nullif(btrim(p_note), '');
  v_input jsonb := jsonb_build_array('transfer', p_from_account_id, p_to_account_id,
    p_occurred_on, p_amount_out, p_amount_in, p_rate_dzd, v_note);
  v_transfer uuid;
  v_from public.accounts;
  v_to public.accounts;
  v_dzd numeric;
  v_usdt numeric;
begin
  if p_request_key is null or p_occurred_on is null or not isfinite(p_occurred_on) then
    raise exception 'A finite date and request key are required' using errcode = '22023';
  end if;

  perform private.lock_ledger(v_workspace);
  v_transfer := private.ledger_replay(v_workspace, p_request_key, v_input);
  if v_transfer is not null then
    return v_transfer;
  end if;
  v_from := private.ledger_account(v_workspace, p_from_account_id);
  v_to := private.ledger_account(v_workspace, p_to_account_id);
  if not private.ledger_amount_valid(p_amount_out, v_from.currency)
    or not private.ledger_amount_valid(p_amount_in, v_to.currency) then
    raise exception 'Invalid transfer amount' using errcode = '22023';
  end if;

  if v_from.kind = 'zr' and v_to.kind = 'dzd' then
    if p_amount_out <> p_amount_in or p_rate_dzd is not null then
      raise exception 'A ZR payout moves the same DZD amount' using errcode = '22023';
    end if;
  elsif (v_from.kind = 'dzd' and v_to.kind = 'usdt') or (v_from.kind = 'usdt' and v_to.kind = 'dzd') then
    v_dzd := case when v_from.currency = 'DZD' then p_amount_out else p_amount_in end;
    v_usdt := case when v_from.currency = 'USDT' then p_amount_out else p_amount_in end;
    if not coalesce(p_rate_dzd > 0 and p_rate_dzd < 100000000 and p_rate_dzd = round(p_rate_dzd, 8)
      and round(v_usdt * p_rate_dzd, 2) = v_dzd, false) then
      raise exception 'The exchange rate must agree with both transfer amounts' using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported account transfer' using errcode = '22023';
  end if;

  v_transfer := gen_random_uuid();
  insert into public.account_entries (workspace_id, account_id, occurred_on, direction,
    amount, note, transfer_id, fx_rate, created_by)
  values (v_workspace, p_from_account_id, p_occurred_on, 'out', p_amount_out, v_note, v_transfer, p_rate_dzd, auth.uid()),
         (v_workspace, p_to_account_id, p_occurred_on, 'in', p_amount_in, v_note, v_transfer, p_rate_dzd, auth.uid());
  perform private.record_ledger_request(v_workspace, p_request_key, v_input, v_transfer);
  return v_transfer;
end;
$$;

create function public.reverse_account_entry(
  p_entry_id uuid,
  p_occurred_on date,
  p_request_key uuid,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_workspace uuid := private.ledger_workspace();
  v_note text := nullif(btrim(p_note), '');
  v_input jsonb := jsonb_build_array('reverse', p_entry_id, p_occurred_on, v_note);
  v_result uuid;
  v_transfer uuid;
  v_original public.account_entries;
begin
  if p_request_key is null or p_occurred_on is null or not isfinite(p_occurred_on) then
    raise exception 'A finite date and request key are required' using errcode = '22023';
  end if;

  perform private.lock_ledger(v_workspace);
  v_result := private.ledger_replay(v_workspace, p_request_key, v_input);
  if v_result is not null then
    return v_result;
  end if;

  select * into v_original from public.account_entries
  where workspace_id = v_workspace and id = p_entry_id;
  if not found or v_original.reverses_entry_id is not null or v_original.legacy_mapping_id is not null
    or v_original.expense_id is not null or v_original.ad_spend_id is not null then
    raise exception 'Only original entries without a linked debit or legacy mapping can be reversed here'
      using errcode = '22023';
  end if;
  perform private.ledger_account(v_workspace, v_original.account_id);
  if v_original.transfer_id is not null then
    v_transfer := gen_random_uuid();
  end if;

  with inserted as (
    insert into public.account_entries (workspace_id, account_id, occurred_on, direction,
      amount, category_id, note, transfer_id, fx_rate, reverses_entry_id, created_by)
    select workspace_id, account_id, p_occurred_on, case direction when 'in' then 'out' else 'in' end,
      amount, category_id, v_note, v_transfer, fx_rate, id, auth.uid()
    from public.account_entries
    where workspace_id = v_workspace and (id = p_entry_id or transfer_id = v_original.transfer_id)
    returning id, reverses_entry_id
  )
  select id into v_result from inserted where reverses_entry_id = p_entry_id;

  v_result := coalesce(v_transfer, v_result);
  perform private.record_ledger_request(v_workspace, p_request_key, v_input, v_result);
  return v_result;
end;
$$;

revoke all on function private.lock_ledger(uuid), private.ledger_workspace(),
  private.ledger_amount_valid(numeric, public.currency_code), private.ledger_replay(uuid, uuid, jsonb),
  private.record_ledger_request(uuid, uuid, jsonb, uuid), private.ledger_account(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function
  public.append_account_entry(uuid, date, text, numeric, uuid, uuid, text, uuid, uuid, uuid),
  public.transfer_account_funds(uuid, uuid, date, numeric, numeric, uuid, numeric, text),
  public.reverse_account_entry(uuid, date, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.append_account_entry(uuid, date, text, numeric, uuid, uuid, text, uuid, uuid, uuid),
  public.transfer_account_funds(uuid, uuid, date, numeric, numeric, uuid, numeric, text),
  public.reverse_account_entry(uuid, date, uuid, text) to authenticated;
