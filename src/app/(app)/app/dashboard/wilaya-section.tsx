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
export function WilayaSection({ rows, minOrders, filters, names }: { rows: WilayaRow[]; minOrders: number; filters: DashboardFilters; names?: Record<number, string> }) {
  const t = useTranslations();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [moreEnd, setMoreEnd] = React.useState(false);
  const measure = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // abs(): scrollLeft is negative in RTL
    const more = Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 1;
    setMoreEnd((m) => (m === more ? m : more));
  }, []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, rows.length]);
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
      <div className="min-w-0">
        <h2 className="mb-3 text-sm font-semibold">{t("dashboard.wilaya.title")}</h2>
        <div className="relative">
        <div ref={scrollRef} onScroll={measure} className="overflow-x-auto">
        <table className={cn(tableClass, "min-w-[34rem]")}>
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
                  <Link href={wilayaHref(w.code)} className="whitespace-nowrap hover:underline">
                    {w.name ? <><bdi dir="ltr">{w.code}</bdi><span> · </span><bdi>{w.name}</bdi></> : <bdi dir="ltr">{w.code}</bdi>}
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
        <div
          aria-hidden
          data-scroll-fade
          className={cn(
            "pointer-events-none absolute inset-y-0 end-0 w-10 bg-linear-to-l from-surface to-transparent transition-opacity rtl:bg-linear-to-r",
            moreEnd ? "opacity-100" : "opacity-0",
          )}
        />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 lg:w-[280px]">
        <AlgeriaMap
          data={rows}
          minOrders={minOrders}
          hovered={hovered}
          onHover={setHovered}
          onSelect={(code) => router.push(wilayaHref(code))}
          label={t("dashboard.wilaya.mapLabel")}
          noDataLabel={t("dashboard.wilaya.noData")}
          names={names}
        />
        <div className="grid grid-cols-3 justify-items-start gap-x-3 gap-y-1 text-xs sm:flex sm:flex-wrap sm:items-center sm:justify-center text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-danger" /><bdi dir="ltr">&lt;40%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange" /><bdi dir="ltr">40–55%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /><bdi dir="ltr">55–70%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-info" /><bdi dir="ltr">70–85%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success" /><bdi dir="ltr">85%+</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neutral/30" />{t("dashboard.wilaya.noData")}</span>
        </div>
      </div>
    </div>
  );
}
