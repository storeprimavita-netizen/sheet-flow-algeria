import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";

/**
 * Actuals net profit for the Statistics tab (SPEC §4). Fixed fees have no
 * date range yet (Ph.7 BI adds period filters), so "the period" here is
 * all-time: workspace fixed-fee total × this product's share of all
 * delivered orders workspace-wide.
 *
 *   net_profit = revenue
 *              − sourcing_cost_dzd × orders_delivered   (per-unit cost × units shipped)
 *              − expenses_dzd − ad_spend_dzd
 *              − fixed_fees_total_dzd × (this.orders_delivered / total_delivered)
 */
function netProfit(stats: {
  revenue_dzd: number | null;
  sourcing_cost_dzd: number | null;
  expenses_dzd: number | null;
  ad_spend_dzd: number | null;
  orders_delivered: number | null;
}, fixedFeesTotalDzd: number, totalDelivered: number) {
  const delivered = stats.orders_delivered ?? 0;
  const share = totalDelivered > 0 ? delivered / totalDelivered : 0;
  const allocatedFixedFees = fixedFeesTotalDzd * share;
  const sourcingDelivered = (stats.sourcing_cost_dzd ?? 0) * delivered;
  const net =
    (stats.revenue_dzd ?? 0) - sourcingDelivered - (stats.expenses_dzd ?? 0) - (stats.ad_spend_dzd ?? 0) - allocatedFixedFees;
  return { allocatedFixedFees, net };
}

export default async function ProductStatisticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: stats }, { data: fixedFees }, { data: allStats }, { data: expenses }] = await Promise.all([
    supabase.from("product_stats").select("*").eq("id", id).maybeSingle(),
    supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", profile.workspaceId),
    supabase.from("product_stats").select("orders_delivered").eq("workspace_id", profile.workspaceId),
    supabase.from("expenses").select("category, amount_dzd").eq("product_id", id),
  ]);
  if (!stats) notFound();

  const fixedFeesTotalDzd = (fixedFees ?? []).reduce((sum, f) => sum + (f.amount_dzd ?? 0), 0);
  const totalDelivered = (allStats ?? []).reduce((sum, p) => sum + (p.orders_delivered ?? 0), 0);
  const { allocatedFixedFees, net } = netProfit(stats, fixedFeesTotalDzd, totalDelivered);

  const delivered = stats.orders_delivered ?? 0;
  const adCostPerDelivered = delivered > 0 ? (stats.ad_spend_dzd ?? 0) / delivered : null;
  const profitPerDelivered = delivered > 0 ? net / delivered : null;

  const byCategory = new Map<string, number>();
  for (const e of expenses ?? []) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount_dzd ?? 0));
  }

  const tiles: [string, string][] = [
    [t("products.statistics.received"), String(stats.orders_received ?? 0)],
    [t("products.statistics.confirmed"), String(stats.orders_confirmed ?? 0)],
    [t("products.statistics.delivered"), String(stats.orders_delivered ?? 0)],
    [t("products.statistics.returned"), String(stats.orders_returned ?? 0)],
    [t("products.statistics.confirmationRate"), stats.confirmation_rate !== null ? `${stats.confirmation_rate}%` : "—"],
    [t("products.statistics.deliveryRate"), stats.delivery_rate !== null ? `${stats.delivery_rate}%` : "—"],
    [t("products.statistics.revenue"), formatCurrency(stats.revenue_dzd)],
    [t("products.statistics.allocatedFixedFees"), formatCurrency(allocatedFixedFees)],
    [t("products.statistics.netProfit"), formatCurrency(net)],
    [t("products.statistics.adCostPerDelivered"), formatCurrency(adCostPerDelivered)],
    [t("products.statistics.profitPerDelivered"), formatCurrency(profitPerDelivered)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="card-surface rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card-surface rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("products.statistics.expensesByCategory")}</h2>
        {byCategory.size === 0 ? (
          <p className="text-sm text-muted-foreground">{t("expenses.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...byCategory.entries()].map(([category, amount]) => (
              <li key={category} className="flex justify-between">
                <span className="text-muted-foreground">{t(`status.expense_category.${category}`)}</span>
                <span>{formatCurrency(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
