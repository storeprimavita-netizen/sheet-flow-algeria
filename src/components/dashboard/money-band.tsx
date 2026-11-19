import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Banknote, Coins, Megaphone, Target, Wallet } from "lucide-react";

import { formatCurrency, formatDate, formatUsd } from "@/lib/format";
import type { Kpi, KpiDailyRow } from "@/lib/kpi";
import { ordersQs, type DashboardFilters } from "@/lib/query-string";
import { kpiRoas } from "@/lib/kpi";
import { KpiTile } from "@/components/stats/kpi-tile";
import { StackedBar } from "@/components/charts/stacked-bar";
import { MoneyChart, type MoneyDay } from "./money-chart";
import { UsdFirst } from "./usd-first";
import { Band, BandError } from "./band";

export type MoneyHrefs = { finance: string; revenue: string; returns: string; ads: string; expenses: string; cogs: string; fixed: string };

/**
 * Band 2 (tiles); `MoneyChartBand` is band 4. Every figure is read from `kpi` (SQL kpi_lines, D45);
 * nothing is derived here. Profit / revenue / cash are DZD-first; ad spend and cost per
 * delivered are USD-first. `prev` (bounded periods only) feeds the profit / ROAS deltas.
 */
export async function MoneyBand({
  kpi,
  prev,
  hrefs,
}: {
  kpi: Kpi | null;
  prev: Kpi | null;
  hrefs: Pick<MoneyHrefs, "revenue" | "ads" | "finance">;
}) {
  const t = await getTranslations("dashboard.v2.money");
  if (!kpi) {
    return (
      <Band id="band-money" title={t("title")}>
        <BandError />
      </Band>
    );
  }
  const delta = (curr: number | null | undefined, before: number | null | undefined) => {
    if (curr == null || before == null) return null;
    if (before === 0) return null; // nothing to compare with (also 0 vs 0: no signal)
    const pct = ((curr - before) / Math.abs(before)) * 100;
    return Math.abs(pct) < 0.05 ? null : pct; // an unchanged figure shows no arrow
  };
  const roas = kpiRoas(kpi);
  const rateLabel = (rate: string, date: string) => t("rateLabel", { rate, date });
  const noRate = t("noRate");
  const net = kpi.net_profit;

  return (
      <Band id="band-money" title={t("title")}>
        {kpi.usd_rate == null ? (
          <Link href="/app/settings?section=exchange-rates" className="mb-1 inline-block text-xs font-medium text-primary hover:underline">
            {noRate}
          </Link>
        ) : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <KpiTile
            hero
            className="lg:col-span-4"
            icon={Wallet}
            label={t("profit")}
            value={formatCurrency(net)}
            tone={net == null ? undefined : net >= 0 ? "success" : "danger"}
            delta={delta(net, prev?.net_profit)}
            sub={prev?.net_profit != null ? t("profitPrev", { amount: formatCurrency(prev.net_profit) }) : t("profitSub", { revenue: formatCurrency(kpi.waterfall?.revenue) })}
            hint={t("profitHint")}
            href={hrefs.finance}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:col-span-8">
            <KpiTile
              icon={Coins}
              label={t("revenue")}
              value={formatCurrency(kpi.waterfall?.revenue)}
              hint={t("revenueHint")}
              href={hrefs.revenue}
            />
            <KpiTile
              icon={Megaphone}
              label={t("adSpend")}
              value={
                <UsdFirst usd={kpi.ad_spend_usd} dzd={kpi.ad_spend_dzd} rate={kpi.usd_rate} date={kpi.usd_rate_date} rateLabel={rateLabel} noRateHint="" />
              }
              hint={t("adSpendHint")}
              href={hrefs.ads}
            />
            <KpiTile
              icon={Target}
              label={t("costPerDelivered")}
              value={
                <UsdFirst
                  usd={kpi.cost_per_delivered_usd}
                  dzd={kpi.cost_per_delivered_dzd}
                  rate={kpi.usd_rate}
                  date={kpi.usd_rate_date}
                  rateLabel={rateLabel}
                  noRateHint=""
                />
              }
              hint={t("costPerDeliveredHint")}
              href={hrefs.finance}
            />
            <KpiTile
              icon={Megaphone}
              label={t("roas")}
              value={roas == null ? "—" : `${roas.toFixed(2)}×`}
              delta={delta(roas, kpiRoas(prev))}
              hint={t("roasHint")}
              href={hrefs.ads}
            />
            <KpiTile className="col-span-2" icon={Banknote} label={t("cashWithZr")} value="—" sub={t("cashWithZrSub")} hint={t("cashWithZrHint")} />
          </div>
        </div>
      </Band>
  );
}

/**
 * Band 4: money per day as a line chart (SQL `kpi_daily`) and the cost breakdown as one stacked bar
 * (SQL `kpi.waterfall`, ads USD first, D45). Nothing is computed here.
 */
export async function MoneyChartBand({
  kpi,
  daily,
  filters,
  hrefs,
}: {
  kpi: Kpi | null;
  daily: KpiDailyRow[] | null;
  filters: DashboardFilters;
  hrefs: MoneyHrefs;
}) {
  const t = await getTranslations("dashboard.v2.money");
  if (!kpi || !daily) {
    return (
      <Band id="band-money-chart" title={t("chart.title")}>
        <BandError />
      </Band>
    );
  }
  const days: MoneyDay[] = daily.flatMap((d) =>
    d.money
      ? [{
          key: d.day,
          label: formatDate(d.day),
          short: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`,
          immature: d.immature,
          revenue: d.money.revenue,
          costs: d.money.costs,
          net: d.money.net_profit,
          href: ordersQs({ ...filters, from: d.day, to: d.day }),
        }]
      : [],
  );
  const wf = kpi.waterfall;
  const slices = wf
    ? [
        { key: "cogs", label: t("wf.cogs"), value: -wf.cogs, display: formatCurrency(-wf.cogs), color: "var(--chart-2)", href: hrefs.cogs },
        { key: "returns", label: t("wf.returns"), value: -wf.returns, display: formatCurrency(-wf.returns), color: "var(--chart-4)", href: hrefs.returns },
        {
          key: "ads",
          label: t("wf.ads"),
          value: -wf.ads,
          display: kpi.usd_rate != null && kpi.ad_spend_usd != null ? `${formatUsd(kpi.ad_spend_usd)} · ${formatCurrency(-wf.ads)}` : formatCurrency(-wf.ads),
          color: "var(--chart-3)",
          href: hrefs.ads,
        },
        { key: "expenses", label: t("wf.expensesFixed"), value: -wf.expenses_fixed, display: formatCurrency(-wf.expenses_fixed), color: "var(--chart-5)", href: hrefs.expenses },
      ].filter((s) => s.value !== 0)
    : [];
  return (
    <Band id="band-money-chart" title={t("chart.title")}>
      <div className="flex flex-1 flex-col gap-3">
        <MoneyChart
          days={days}
          total={formatCurrency(kpi.net_profit)}
          emptyAction={{ label: t("chart.emptyAction"), href: "/app/orders/new" }}
        />
        <StackedBar
          title={t("chart.costsTitle")}
          slices={slices}
          head={[t("chart.costHead"), t("chart.amountHead"), t("chart.shareHead")]}
          empty={slices.length ? null : { title: t("noData") }}
        />
      </div>
    </Band>
  );
}
