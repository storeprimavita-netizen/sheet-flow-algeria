"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";

import { cn } from "@/lib/utils";
import { ordersQs, type DashboardFilters } from "@/lib/query-string";
import { tableClass } from "@/components/field";
import { Empty } from "@/components/empty";
import { AlgeriaMap, type WilayaMapDatum } from "@/components/dashboard/algeria-map";
import { RateCell } from "@/components/stats/rate-bar";

export type WilayaRow = WilayaMapDatum & {
  deliveredOrders: number;
};

/**
 * Per-wilaya table (source of truth for numbers) beside the Algeria choropleth
 * (for spotting patterns) — hover syncs both ways, click drills into Orders
 * filtered to that wilaya. Map stacks below the table on narrow screens
 * (grid-cols-1 lg:grid-cols-[1fr,auto]).
 */
export function WilayaSection({ rows, minOrders, filters }: { rows: WilayaRow[]; minOrders: number; filters: DashboardFilters }) {
  const t = useTranslations();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<number | null>(null);
  const wilayaHref = (code: number) => ordersQs(filters, { wilaya_code: String(code) });

  if (!rows.length) {
    return (
      <div className="card-surface rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("dashboard.wilaya.title")}</h2>
        <Empty>{t("dashboard.noData")}</Empty>
      </div>
    );
  }

  return (
    <div className="card-surface grid grid-cols-1 gap-5 rounded-xl p-5 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0 overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">{t("dashboard.wilaya.title")}</h2>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{t("fields.wilaya")}</th>
              <th>{t("common.total")}</th>
              <th>{t("dashboard.funnel.confirmed")}</th>
              <th>{t("dashboard.funnel.delivered")}</th>
              <th>{t("dashboard.kpi.deliveryRate")}</th>
              <th>{t("dashboard.wilaya.stopShipping")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr
                key={w.code}
                className={cn("cursor-pointer transition-colors", hovered === w.code && "bg-surface-raised")}
                onMouseEnter={() => setHovered(w.code)}
                onMouseLeave={() => setHovered(null)}
              >
                <td>
                  <Link href={wilayaHref(w.code)} className="hover:underline">
                    {w.name ? `${w.code}-${w.name}` : w.code}
                  </Link>
                </td>
                <td className="num">{w.totalOrders}</td>
                <td className="num">{w.confirmedOrders}</td>
                <td className="num">{w.deliveredOrders}</td>
                <td className="min-w-28">
                  <RateCell pct={w.deliveryRate ?? 0} label={w.deliveryRate !== null ? `${w.deliveryRate}%` : "—"} />
                </td>
                <td>
                  {w.stopShippingManual || w.stopShippingAuto ? (
                    <span className="inline-flex items-center gap-1 text-xs text-danger" title={w.stopShippingManual ? t("dashboard.wilaya.stopShippingManual") : t("dashboard.wilaya.stopShippingAuto")}>
                      <Ban className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center gap-2 lg:w-[280px]">
        <AlgeriaMap data={rows} minOrders={minOrders} hovered={hovered} onHover={setHovered} onSelect={(code) => router.push(wilayaHref(code))} />
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-danger" />&lt;40%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange" />40–55%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warning" />55–70%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-info" />70–85%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success" />85%+</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neutral/30" />{t("dashboard.wilaya.noData")}</span>
        </div>
      </div>
    </div>
  );
}
