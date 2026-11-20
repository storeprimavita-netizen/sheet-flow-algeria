import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { asPnl } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { getOptionSet } from "@/lib/option-sets";
import { AdSpendForm } from "@/components/finance/ad-spend-form";
import { ExpenseTable } from "@/components/finance/expense-table";

export default async function ProductExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = await requireProfile();

  const supabase = await createClient();
  const [{ data: product }, { data: expenses }, { data: suppliers }, { data: pnlRaw }, usdRate, eurRate, subcategories] =
    await Promise.all([
      supabase.from("products").select("id").eq("id", id).maybeSingle(),
      supabase.from("expenses").select("*").eq("product_id", id).order("spent_on", { ascending: false }),
      supabase.from("contacts").select("id, name").order("name"),
      supabase.rpc("pnl_summary", { p_product: id }),
      supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
      supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
      getOptionSet(profile.workspaceId, "expense_subcategory"),
    ]);
  if (!product) notFound();

  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };

  const pnl = asPnl(pnlRaw);
  const income = pnl?.revenue ?? 0;
  const net = pnl?.net_profit ?? 0;
  const spend = income - net; // every cost line: COGS, returns, ads, expenses, fixed share

  return (
    <div className="space-y-6">
      {/* income (auto from delivered orders) / spend / net — side by side */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label={t("products.income")} value={formatCurrency(income)} tone="success" />
        <Kpi label={t("products.spend")} value={formatCurrency(spend)} tone="danger" />
        <Kpi label={t("products.statistics.netProfit")} value={formatCurrency(net)} tone={net >= 0 ? "success" : "danger"} />
      </div>

      <AdSpendForm productId={id} rates={rates} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("expenses.title")}</h2>
        <ExpenseTable expenses={expenses ?? []} productId={id} suppliers={suppliers ?? []} subcategories={subcategories} rates={rates} />
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "neutral" }) {
  return (
    <div className="card-surface rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-lg font-semibold", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "")}>
        {value}
      </div>
    </div>
  );
}
