-- STORE-1 (D54): reason for the two linked lines written by a count by size.
-- Own file: a new enum value cannot be used in the transaction that adds it.
alter type public.stock_reason add value if not exists 'stock_count';
