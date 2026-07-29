import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { netProfit } from "@/lib/product-metrics";
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
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: product }, { data: expenses }, { data: suppliers }, { data: stats }, { data: allStats }, { data: fees }, usdRate, eurRate, subcategories] =
    await Promise.all([
      supabase.from("products").select("id").eq("id", id).maybeSingle(),
      supabase.from("expenses").select("*").eq("product_id", id).order("spent_on", { ascending: false }),
      supabase.from("contacts").select("id, name").order("name"),
      supabase.from("product_stats").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_stats").select("orders_delivered").eq("workspace_id", profile.workspaceId),
      supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", profile.workspaceId).eq("is_active", true),
      supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
      supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
      getOptionSet(profile.workspaceId, "expense_subcategory"),
    ]);
  if (!product) notFound();

  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };

  const fixedFeesTotal = (fees ?? []).reduce((s, f) => s + (f.amount_dzd ?? 0), 0);
  const totalDelivered = (allStats ?? []).reduce((s, p) => s + (p.orders_delivered ?? 0), 0);
  const income = stats?.revenue_dzd ?? 0;
  const spend = (stats?.expenses_dzd ?? 0) + (stats?.ad_spend_dzd ?? 0);
  const net = stats ? netProfit(stats, fixedFeesTotal, totalDelivered).net : 0;

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
