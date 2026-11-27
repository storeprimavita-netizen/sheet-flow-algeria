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
  /** on hand, from product_stock_v */
  inStock: number | null;
};

/** Band 6 — one row per product; every figure from SQL (`per_product`, `pnl_by_product`, `product_stock_v`). */
export async function ProductScorecard({ rows, hasProducts }: { rows: ScorecardRow[] | null; hasProducts: boolean }) {
  const t = await getTranslations("dashboard.v2.scorecard");
  const tm = await getTranslations("dashboard.v2.money");
  const noRate = !!rows && rows.length > 0 && rows.every((r) => r.kpi?.usd_rate == null);
  const cpd = (r: ScorecardRow, className?: string) => (
    <UsdFirst
      className={className}
      usd={r.kpi?.cost_per_delivered_usd}
      dzd={r.kpi?.cost_per_delivered_dzd}
      rate={r.kpi?.usd_rate}
      date={r.kpi?.usd_rate_date}
      rateLabel={(rate, date) => tm("rateLabel", { rate, date })}
      noRateHint=""
    />
  );
  const roasText = (r: ScorecardRow) => {
    const roas = kpiRoas(r.kpi);
    return roas == null ? "—" : `${roas.toFixed(2)}×`;
  };
  const profitClass = (r: ScorecardRow) => (r.netProfit == null ? "" : r.netProfit >= 0 ? "text-success" : "text-danger");
  return (
    <Band id="band-scorecard" title={t("title")}>
      {!rows ? (
        <BandError />
      ) : rows.length === 0 ? (
        <Empty>{hasProducts ? t("noPeriod") : t("empty")}</Empty>
      ) : (
        <div className="space-y-2">
          {noRate ? (
            <Link href="/app/settings?section=exchange-rates" className="inline-flex items-center text-xs font-medium text-primary hover:underline max-sm:min-h-11">
              {tm("noRate")}
            </Link>
          ) : null}
          {/* phones: one stacked card per product, nothing to scroll */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.productId} className="card-surface space-y-3 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/app/catalog/products/${r.productId}/statistics`} className="min-w-0 truncate font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className={`num whitespace-nowrap text-sm font-semibold ${profitClass(r)}`}>{formatCurrency(r.netProfit)}</span>
                </div>
                <RateCell pct={r.deliveryRate ?? 0} label={r.deliveryRate == null ? "—" : `${r.deliveryRate}%`} />
                <dl className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <dt>{t("costPerDelivered")}</dt>
                    <dd className="text-sm text-foreground">{cpd(r)}</dd>
                  </div>
                  <div>
                    <dt>{t("roas")}</dt>
                    <dd className="num text-sm text-foreground">{roasText(r)}</dd>
                  </div>
                  <div>
                    <dt>{t("stock")}</dt>
                    <dd className="num text-sm text-foreground">{r.inStock ?? "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="card-surface hidden overflow-x-auto rounded-xl p-5 pt-3 md:block">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("product")}</th>
                  <th>{t("deliveryRate")}</th>
                  <th className="!text-end">{t("stock")}</th>
                  <th className="!text-end">{t("costPerDelivered")}</th>
                  <th className="!text-end">{t("roas")}</th>
                  <th className="!text-end">{t("profit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId}>
                    <td>
                      <Link href={`/app/catalog/products/${r.productId}/statistics`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="min-w-28">
                      <RateCell pct={r.deliveryRate ?? 0} label={r.deliveryRate == null ? "—" : `${r.deliveryRate}%`} />
                    </td>
                    <td className="num whitespace-nowrap text-end">{r.inStock ?? "—"}</td>
                    <td className="text-end">{cpd(r, "items-end")}</td>
                    <td className="num whitespace-nowrap text-end">{roasText(r)}</td>
                    <td className={`num whitespace-nowrap text-end ${profitClass(r)}`}>{formatCurrency(r.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Band>
  );
}
