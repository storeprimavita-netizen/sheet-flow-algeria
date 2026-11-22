-- The new enum value must be committed before another migration uses it.
alter type public.currency_code add value 'USDT';
