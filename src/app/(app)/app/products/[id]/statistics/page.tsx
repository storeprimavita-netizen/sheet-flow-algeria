import { asKpi } from "@/lib/kpi";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { asPnl } from "@/lib/pricing";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Funnel } from "@/components/stats/funnel";
import { Chip } from "@/components/ui/chip";
import { CATEGORY_ICONS } from "@/components/fields/category-select";

export default async function ProductStatisticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: stats }, { data: pnlRaw }, { data: expenses }, { data: kpiRaw }] = await Promise.all([
    supabase.from("product_stats").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("pnl_summary", { p_product: id }),
    supabase.from("expenses").select("category, amount_dzd").eq("product_id", id),
    supabase.rpc("kpi_summary", { p_product: id }),
  ]);
  if (!stats) notFound();

  // One money model (00022): same lines the dashboard and finance read.
  const pnl = asPnl(pnlRaw);
  const net = pnl?.net_profit ?? 0;
  const allocatedFixedFees = pnl?.fixed_fees ?? 0;

  const kpi = asKpi(kpiRaw);
  const delivered = stats.orders_delivered ?? 0;
  const hasData = (stats.orders_received ?? 0) > 0;
  const adCostPerDelivered = kpi?.cpa_delivered_dzd ?? null; // SQL kpi_lines, not derived here
  const profitPerDelivered = delivered > 0 ? net / delivered : null;

  const byCategory = new Map<string, number>();
  for (const e of expenses ?? []) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount_dzd ?? 0));
  }

  const ordersHref = `/app/products/${id}/orders`;
  const pct = (v: number | null) => (v !== null ? `${v}%` : "—");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiTile label={t("products.statistics.revenue")} value={formatCurrency(stats.revenue_dzd)} tone="success" href={ordersHref} />
        <KpiTile
          label={t("products.statistics.netProfit")}
          value={formatCurrency(net)}
          tone={net >= 0 ? "success" : "danger"}
        />
        <KpiTile label={t("products.statistics.confirmationRate")} value={pct(stats.confirmation_rate)} />
        <KpiTile label={t("products.statistics.deliveryRate")} value={pct(stats.delivery_rate)} />
        <KpiTile label={t("products.statistics.allocatedFixedFees")} value={formatCurrency(allocatedFixedFees)} />
        <KpiTile label={t("products.statistics.adCostPerDelivered")} value={formatCurrency(adCostPerDelivered)} />
        <KpiTile
          label={t("products.statistics.profitPerDelivered")}
          value={formatCurrency(profitPerDelivered)}
          tone={(profitPerDelivered ?? 0) >= 0 ? "success" : "danger"}
        />
        <KpiTile label={t("products.statistics.returned")} value={String(stats.orders_returned ?? 0)} href={ordersHref} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-surface rounded-xl p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("products.funnel")}</h2>
          {hasData ? (
            <Funnel
              stages={[
                { label: t("products.statistics.received"), count: stats.orders_received ?? 0, href: ordersHref },
                { label: t("products.statistics.confirmed"), count: stats.orders_confirmed ?? 0, href: ordersHref },
                { label: t("products.statistics.delivered"), count: delivered, href: ordersHref },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("products.statsEmptyHint")}</p>
          )}
        </div>

        <div className="card-surface rounded-xl p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("products.statistics.expensesByCategory")}</h2>
          {byCategory.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t("expenses.none")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
                  return (
                    <li key={category} className="flex items-center justify-between gap-2">
                      <Chip token="neutral" size="sm" icon={Icon ? <Icon className="h-3 w-3" /> : undefined}>
                        {t(`status.expense_category.${category}`)}
                      </Chip>
                      <span className="num">{formatCurrency(amount)}</span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
