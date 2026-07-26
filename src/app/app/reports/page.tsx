import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { RangeFilter } from "./range-filter";
import {
  ReportsExporter,
  type CashExport,
  type ExpenseExport,
  type OrderExport,
} from "./reports-exporter";

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdmin("/app/reports");
  const t = await getTranslations();
  const supabase = await createClient();

  const sp = await searchParams;
  const from = sp.from || monthStart();
  const to = sp.to || today();
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;

  const [ordersRes, expensesRes, cashRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "order_number, placed_at, quantity, total_amount, confirmation_status, delivery_status, product:products(name), customer:contacts(name)",
      )
      .gte("placed_at", fromTs)
      .lte("placed_at", toTs)
      .order("placed_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("incurred_on, category, amount, notes, product:products(name), order:orders(order_number)")
      .gte("incurred_on", from)
      .lte("incurred_on", to)
      .order("incurred_on", { ascending: false }),
    supabase
      .from("cash_collections")
      .select("collected_at, amount, collected_by, status, deposit_reference, deposited_at, order:orders(order_number)")
      .gte("collected_at", fromTs)
      .lte("collected_at", toTs)
      .order("collected_at", { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as any[];
  const expenses = (expensesRes.data ?? []) as any[];
  const cash = (cashRes.data ?? []) as any[];

  const revenue = orders
    .filter((o) => o.delivery_status === "delivered")
    .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const collected = cash.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const deposited = cash
    .filter((c) => c.status === "deposited")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // expenses by category
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount ?? 0));

  const orderExport: OrderExport[] = orders.map((o) => ({
    order_number: o.order_number,
    placed_at: o.placed_at,
    customer_name: o.customer?.name ?? null,
    product_name: o.product?.name ?? null,
    quantity: o.quantity,
    total_amount: o.total_amount,
    confirmation_status: o.confirmation_status,
    delivery_status: o.delivery_status,
  }));
  const expenseExport: ExpenseExport[] = expenses.map((e) => ({
    incurred_on: e.incurred_on,
    category: e.category,
    amount: e.amount,
    product_name: e.product?.name ?? null,
    order_number: e.order?.order_number ?? null,
    notes: e.notes,
  }));
  const cashExport: CashExport[] = cash.map((c) => ({
    collected_at: c.collected_at,
    order_number: c.order?.order_number ?? null,
    amount: c.amount,
    collected_by: c.collected_by,
    status: c.status,
    deposit_reference: c.deposit_reference,
    deposited_at: c.deposited_at,
  }));

  const cards = [
    { label: t("reports.revenue"), value: formatCurrency(revenue), accent: false },
    { label: t("reports.expenses"), value: formatCurrency(expensesTotal), accent: false },
    { label: t("reports.net"), value: formatCurrency(revenue - expensesTotal), accent: true },
    { label: t("reports.collected"), value: formatCurrency(collected), accent: false },
    { label: t("reports.deposited"), value: formatCurrency(deposited), accent: false },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <RangeFilter from={from} to={to} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-xl font-bold ${c.accent ? "text-gradient" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <ReportsExporter orders={orderExport} expenses={expenseExport} cash={cashExport} />

      <div className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("reports.byCategory")}</h2>
        {!byCategory.size ? (
          <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <Badge key={cat} variant="secondary">
                {t(`status.expense_category.${cat}`)}: {formatCurrency(amt)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
