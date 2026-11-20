/**
 * Old /app URLs → canonical NAV-3 URLs. Permanent (308); Next preserves the
 * query string. Order matters: first match wins, so static paths precede
 * their `:id` siblings.
 */
export const LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/app/orders/confirmation", destination: "/app/sell/confirmation" },
  { source: "/app/orders/delivery", destination: "/app/sell/shipping" },
  { source: "/app/orders/all", destination: "/app/sell/orders" },
  { source: "/app/orders/new", destination: "/app/sell/orders/new" },
  { source: "/app/orders/cash", destination: "/app/money/courier-cash" },
  { source: "/app/orders/:id", destination: "/app/sell/orders/:id" },
  { source: "/app/contacts/suppliers", destination: "/app/money/suppliers" },
  { source: "/app/contacts/suppliers/:path*", destination: "/app/money/suppliers/:path*" },
  { source: "/app/contacts", destination: "/app/sell/customers" },
  { source: "/app/contacts/:id", destination: "/app/sell/customers/:id" },
  { source: "/app/products/planner", destination: "/app/catalog/pricing" },
  { source: "/app/products/:path*", destination: "/app/catalog/products/:path*" },
  { source: "/app/products", destination: "/app/catalog/products" },
  { source: "/app/stock", destination: "/app/catalog/stock" },
  { source: "/app/pricing", destination: "/app/catalog/pricing" },
  { source: "/app/finance/overview", destination: "/app/money/overview" },
  { source: "/app/finance/accounts", destination: "/app/money/accounts" },
  { source: "/app/finance/expenses", destination: "/app/money/expenses" },
  { source: "/app/finance/ad-spend", destination: "/app/money/ad-spend" },
  { source: "/app/finance/income", destination: "/app/money/courier-cash?tab=income" },
  { source: "/app/finance", destination: "/app/money" },
];
