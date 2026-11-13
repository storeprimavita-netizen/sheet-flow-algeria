-- 14e: add category column to rules_docs + seed example rules.
alter table public.rules_docs
  add column if not exists category text;

-- Seed example rules (EN content — admin edits in preferred language).
-- Idempotent: only inserts if no rules exist for the workspace.
insert into public.rules_docs (workspace_id, title, content, category, position)
select w.id, v.title, v.content, v.category, v.rn
from public.workspaces w
cross join (
  values
    ('Respect meeting times',                                'Always arrive on time to meetings. If you cannot attend, notify the team in advance.', 'must',             1),
    ('Deliver orders on time',                              'All orders must be delivered within the promised timeframe. Track delivery status daily.', 'must',             2),
    ('At least 2 creatives per product',                    'Every product listing must have at least 2 creative variations (images or videos).', 'product_choice',   3),
    ('No competitor OR at least 1 competitor',               'Avoid products that have direct competitors, or ensure at least 1 competitor product is in the catalog for comparison.', 'product_choice',   4),
    ('Seasonal products only',                              'Focus on seasonal and trend-aligned products. Do not list off-season items.', 'product_choice',   5),
    ('Check pricing',                                       'Research and verify the pricing of new products before adding them to the catalog.', 'new_product_task', 6),
    ('Find the fabric + contact supplier',                   'Source the fabric or material and establish contact with the supplier for new products.', 'new_product_task', 7),
    ('Prepare creatives',                                   'Create ad creatives (images, videos, copy) for new product listings.', 'new_product_task', 8),
    ('Prepare product page',                                'Set up the full product page including description, pricing, and images.', 'new_product_task', 9),
    ('Compare metrics after launch',                        'After launching ads, compare performance metrics against targets within 48 hours.', 'delivery',        10)
) as v(title, content, category, rn)
where not exists (
  select 1 from public.rules_docs rd where rd.workspace_id = w.id limit 1
);
