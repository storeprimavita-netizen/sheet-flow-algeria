import { getTranslations } from "next-intl/server";
import { Banknote, Coins, Megaphone, Target, Wallet } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { Kpi } from "@/lib/kpi";
import { kpiRoas } from "@/lib/kpi";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Empty } from "@/components/empty";
import { buildSteps, WaterfallRows } from "./pnl-waterfall";
import { UsdFirst } from "./usd-first";
import { Band, BandError } from "./band";

export type MoneyHrefs = { revenue: string; returns: string; ads: string; expenses: string; cogs: string; fixed: string };

/**
 * Band 2 (tiles); `WaterfallBand` is band 4. Every figure is read from `kpi` (SQL kpi_lines, D45);
 * nothing is derived here. Profit / revenue / cash are DZD-first; ad spend and cost per
 * delivered are USD-first. `prev` (bounded periods only) feeds the profit / ROAS deltas.
 */
export async function MoneyBand({
  kpi,
  prev,
  hrefs,
  retryHref,
}: {
  kpi: Kpi | null;
  prev: Kpi | null;
  hrefs: Pick<MoneyHrefs, "revenue" | "ads">;
  retryHref: string;
}) {
  const t = await getTranslations("dashboard.v2.money");
  if (!kpi) {
    return (
      <Band id="band-money" title={t("title")}>
        <BandError retryHref={retryHref} />
      </Band>
    );
  }
  const delta = (curr: number | null | undefined, before: number | null | undefined) => {
    if (curr == null || before == null) return null;
    if (before === 0) return curr === 0 ? 0 : null;
    return ((curr - before) / Math.abs(before)) * 100;
  };
  const roas = kpiRoas(kpi);
  const rateLabel = (rate: string, date: string) => t("rateLabel", { rate, date });
  const noRate = t("noRate");
  const net = kpi.net_profit;

  return (
      <Band id="band-money" title={t("title")}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <KpiTile
            hero
            className="lg:col-span-4"
            icon={Wallet}
            label={t("profit")}
            value={formatCurrency(net)}
            tone={net == null ? undefined : net >= 0 ? "success" : "danger"}
            delta={delta(net, prev?.net_profit)}
            hint={t("profitHint")}
            href={hrefs.revenue}
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
                <UsdFirst usd={kpi.ad_spend_usd} dzd={kpi.ad_spend_dzd} rate={kpi.usd_rate} date={kpi.usd_rate_date} rateLabel={rateLabel} noRateHint={noRate} />
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
                  noRateHint={noRate}
                />
              }
              hint={t("costPerDeliveredHint")}
            />
            <KpiTile
              icon={Megaphone}
              label={t("roas")}
              value={roas == null ? "—" : `${roas.toFixed(2)}×`}
              delta={delta(roas, kpiRoas(prev))}
              hint={t("roasHint")}
              href={hrefs.ads}
            />
            <KpiTile icon={Banknote} label={t("cashWithZr")} value="—" sub={t("cashWithZrSub")} hint={t("cashWithZrHint")} />
          </div>
        </div>
      </Band>
  );
}

export async function WaterfallBand({ kpi, hrefs, retryHref }: { kpi: Kpi | null; hrefs: MoneyHrefs; retryHref: string }) {
  const t = await getTranslations("dashboard.v2.money");
  const net = kpi?.net_profit;
  if (!kpi) {
    return (
      <Band id="band-waterfall" title={t("waterfallTitle")}>
        <BandError retryHref={retryHref} />
      </Band>
    );
  }
  return (
      <Band id="band-waterfall" title={t("waterfallTitle")}>
        <div className="card-surface rounded-xl p-5">
          {kpi.waterfall && net != null ? (
            <WaterfallRows
              steps={buildSteps(
                kpi.waterfall.revenue,
                [
                  { key: "cogs", label: t("wf.cogs"), value: -kpi.waterfall.cogs, href: hrefs.cogs },
                  { key: "returns", label: t("wf.returns"), value: -kpi.waterfall.returns, href: hrefs.returns },
                  { key: "ads", label: t("wf.ads"), value: -kpi.waterfall.ads, href: hrefs.ads },
                  { key: "expenses", label: t("wf.expensesFixed"), value: -kpi.waterfall.expenses_fixed, href: hrefs.expenses },
                ],
                net,
                { revenue: t("wf.revenue"), net: t("wf.net") },
                { revenue: hrefs.revenue },
              )}
            />
          ) : (
            <Empty className="border-0 p-4">{t("noData")}</Empty>
          )}
        </div>
      </Band>
  );
}
