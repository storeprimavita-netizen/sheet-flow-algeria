"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { KpiGroup } from "@/lib/kpi";
import { drillHref, type DashboardFilters, type DrillMetric } from "@/lib/query-string";
import { tableClass } from "@/components/field";
import { MetricCell } from "@/components/stats/metric-cell";

export type StatsRow = {
  code: number;
  name: string | null;
  group: KpiGroup;
};

/**
 * Per-wilaya table (source of truth for the numbers). The chevron link opens
 * the commune panel (`?wilaya=`, one at a time, other params kept); the name
 * and every count drill into the exact orders behind them.
 */
export function WilayaTable({
  rows,
  filters,
  openWilaya,
  panel,
  hovered,
  onHover,
}: {
  rows: StatsRow[];
  filters: DashboardFilters;
  openWilaya: number | null;
  /** server-rendered commune panel (own Suspense), shown under the open row */
  panel: React.ReactNode;
  hovered: number | null;
  onHover: (code: number | null) => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toggleHref = (code: number) => {
    const next = new URLSearchParams(sp.toString());
    if (openWilaya === code) next.delete("wilaya");
    else next.set("wilaya", String(code));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const notEnough = t("statistics.notEnoughData");
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

  return (
    <div className="relative">
    <div ref={scrollRef} onScroll={measure} className="overflow-x-auto">
      <table className={cn(tableClass, "min-w-[30rem]")}>
        <thead>
          <tr>
            <th className="sticky start-0 z-[1] bg-surface">{t("fields.wilaya")}</th>
            <th className="text-end">{t("statistics.received")}</th>
            <th>{t("statistics.confirmation")}</th>
            <th>{t("statistics.delivery")}</th>
            <th>{t("statistics.returnRate")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => {
            const { rates } = w.group;
            const open = openWilaya === w.code;
            const panelId = `commune-panel-${w.code}`;
            const href = (m: DrillMetric) => drillHref(filters, m, { wilaya: w.code });
            return (
              <React.Fragment key={w.code}>
                <tr
                  className={cn("transition-colors", (hovered === w.code || open) && "bg-surface-raised")}
                  onMouseEnter={() => onHover(w.code)}
                  onMouseLeave={() => onHover(null)}
                >
                  <td className={cn("sticky start-0 z-[1]", hovered === w.code || open ? "bg-surface-raised" : "bg-surface")}>
                    <div className="flex items-center gap-1">
                      <Link
                        href={toggleHref(w.code)}
                        scroll={false}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={t(open ? "statistics.collapse" : "statistics.expand", { name: w.name ?? String(w.code) })}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform rtl:-scale-x-100", open && "rotate-90 rtl:rotate-90")} />
                      </Link>
                      <span className="whitespace-nowrap">
                        {w.name ? <><bdi dir="ltr">{w.code}</bdi><span> · </span><bdi>{w.name}</bdi></> : <bdi dir="ltr">{w.code}</bdi>}
                      </span>
                    </div>
                  </td>
                  <td className="num text-end">
                    {rates.counts.received > 0 ? (
                      <Link href={href("received")} className="underline-offset-2 hover:underline">{rates.counts.received}</Link>
                    ) : (
                      rates.counts.received
                    )}
                  </td>
                  <td className="min-w-32"><MetricCell m={rates.confirmation} numHref={href("confirmed")} title={notEnough} /></td>
                  <td className="min-w-32"><MetricCell m={rates.delivery} numHref={href("delivered")} title={notEnough} /></td>
                  <td className="min-w-32"><MetricCell m={rates.return} numHref={href("return")} title={notEnough} /></td>
                </tr>
                {open ? (
                  <tr>
                    <td colSpan={5} id={panelId} className="bg-surface p-0">
                      {panel}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
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
  );
}
