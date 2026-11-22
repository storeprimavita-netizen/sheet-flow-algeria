-- Read-only D97 preview for the pre-MONEY-1 schema. Run as the database owner.
begin transaction read only;

with proposed as (
  select a.*, case when num_nonnulls(zr, dzd, usdt) = 1 then coalesce(zr, dzd, usdt) end as proposed_kind
  from public.accounts a cross join lateral (select
    case when lower(a.name) ~ '(^|[^a-z0-9])(zr|courier|carrier|zrexpress)([^a-z0-9]|$)|شركة التوصيل' then 'zr' end as zr,
    case when a.currency = 'DZD' and lower(a.name) ~ '(^|[^a-z0-9])(cash|bank|dzd|dinar|banque|caisse)([^a-z0-9]|$)|بنك|دينار|صندوق' then 'dzd' end as dzd,
    case when lower(a.name) ~ '(^|[^a-z0-9])(crypto|binance|usdt)([^a-z0-9]|$)|بينانس' then 'usdt' end as usdt
  ) hints
), sources as (
  select 'opening' as source_type, a.id as source_id, a.workspace_id, a.id as account_id,
    a.opening_balance as amount, a.currency, (a.created_at at time zone 'Africa/Algiers')::date as occurred_on,
    null::numeric as fx_rate, null::numeric as amount_dzd
  from public.accounts a
  union all
  select 'topup', t.id, t.workspace_id, t.account_id, t.amount, a.currency, t.occurred_on, null, null
  from public.account_topups t join public.accounts a on a.id = t.account_id
  union all
  select 'expense', id, workspace_id, account_id, amount, currency, spent_on, fx_rate, amount_dzd
  from public.expenses where account_id is not null
  union all
  select 'ad_spend', id, workspace_id, account_id, amount, currency, spent_on, fx_rate, amount_dzd
  from public.ad_spend_daily where account_id is not null
), amounts as (
  select a.id as legacy_account_id, a.workspace_id, a.name, a.currency as account_currency,
    b.balance as original_balance, a.proposed_kind,
    s.source_type, s.source_id, s.amount as original_amount, s.currency as original_currency, s.occurred_on,
    case
      when a.workspace_id <> s.workspace_id or a.proposed_kind is null then null
      when (s.amount <= -100000000000000 or s.amount >= 100000000000000) or not isfinite(s.occurred_on) then null
      when s.currency::text = case when a.proposed_kind = 'usdt' then 'USDT' else 'DZD' end then abs(s.amount)
      when s.amount = 0 and (s.source_type not in ('expense', 'ad_spend') or s.amount_dzd = 0) then 0
      when s.source_type in ('expense', 'ad_spend') and a.proposed_kind in ('dzd', 'zr')
        and s.fx_rate > 0 and s.fx_rate < 100000000 and s.fx_rate <> 1
        and s.amount_dzd >= 0 and s.amount_dzd < 100000000000000 then s.amount_dzd
    end as proposed_amount,
    (a.workspace_id <> s.workspace_id) as invalid_workspace_link
  from proposed a join sources s on s.account_id = a.id
  join public.account_balances b on b.workspace_id = a.workspace_id and b.account_id = a.id
)
select *, case
  when invalid_workspace_link then 'workspace link needs correction'
  when proposed_kind is null then 'destination needs review'
  when proposed_amount is null then 'source or conversion needs review'
  else 'exact'
end as status
from amounts order by workspace_id, legacy_account_id, source_type, source_id;

rollback;
