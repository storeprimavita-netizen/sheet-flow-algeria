import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { formatCurrency } from "@/lib/format";
import { kpiRoas, type Kpi } from "@/lib/kpi";
import { tableClass } from "@/components/field";
import { Empty } from "@/components/empty";
import { RateCell } from "@/components/stats/rate-bar";
import { UsdFirst } from "./usd-first";
import { Band, BandError } from "./band";

export type ScorecardRow = {
  productId: string;
  name: string;
  /** delivered / confirmed fraction as a percent, from SQL (dashboard_stats.per_product) */
  deliveryRate: number | null;
  kpi: Kpi | null;
  netProfit: number | null;
};

/** Band 6 — one row per product; every figure from SQL (`per_product`, `pnl_by_product`). */
export async function ProductScorecard({ rows, retryHref }: { rows: ScorecardRow[] | null; retryHref: string }) {
  const t = await getTranslations("dashboard.v2.scorecard");
  const tm = await getTranslations("dashboard.v2.money");
  return (
    <Band id="band-scorecard" title={t("title")}>
      {!rows ? (
        <BandError retryHref={retryHref} />
      ) : rows.length === 0 ? (
        <Empty>{t("empty")}</Empty>
      ) : (
        <div className="card-surface overflow-x-auto rounded-xl p-5 pt-3">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("product")}</th>
                <th>{t("deliveryRate")}</th>
                <th className="!text-end">{t("costPerDelivered")}</th>
                <th className="!text-end">{t("roas")}</th>
                <th className="!text-end">{t("profit")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const roas = kpiRoas(r.kpi);
                return (
                  <tr key={r.productId}>
                    <td>
                      <Link href={`/app/products/${r.productId}/statistics`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="min-w-28">
                      <RateCell pct={r.deliveryRate ?? 0} label={r.deliveryRate == null ? "—" : `${r.deliveryRate}%`} />
                    </td>
                    <td className="text-end">
                      <UsdFirst
                        className="items-end"
                        usd={r.kpi?.cost_per_delivered_usd}
                        dzd={r.kpi?.cost_per_delivered_dzd}
                        rate={r.kpi?.usd_rate}
                        date={r.kpi?.usd_rate_date}
                        rateLabel={(rate, date) => tm("rateLabel", { rate, date })}
                        noRateHint={tm("noRate")}
                      />
                    </td>
                    <td className="num whitespace-nowrap text-end">{roas == null ? "—" : `${roas.toFixed(2)}×`}</td>
                    <td
                      className={`num whitespace-nowrap text-end ${r.netProfit == null ? "" : r.netProfit >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatCurrency(r.netProfit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Band>
  );
}
