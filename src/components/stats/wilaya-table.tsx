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
import { MetricCell, DRILL_LINK } from "@/components/stats/metric-cell";

export type StatsRow = {
  /** null = orders without a wilaya (no drill, no communes) */
  code: number | null;
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
      <table className={cn(tableClass, "max-sm:[&_td]:px-1 max-sm:[&_th]:px-1 max-sm:[&_th]:text-[10px] max-sm:text-xs sm:min-w-[32rem]")}>
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
            const code = w.code;
            const open = code !== null && openWilaya === code;
            const panelId = `commune-panel-${code}`;
            const href = (m: DrillMetric) => (code === null ? undefined : drillHref(filters, m, { wilaya: code }));
            return (
              <React.Fragment key={code ?? "unknown"}>
                <tr
                  className={cn("transition-colors", (hovered === code || open) && "bg-surface-raised")}
                  onMouseEnter={() => onHover(code)}
                  onMouseLeave={() => onHover(null)}
                >
                  <td className={cn("sticky start-0 z-[1]", hovered === code || open ? "bg-surface-raised" : "bg-surface")}>
                    <div className="flex items-center sm:gap-1">
                      {code === null ? <span className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" /> : <Link
                        href={toggleHref(code)}
                        scroll={false}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={t(open ? "statistics.collapse" : "statistics.expand", { name: w.name ?? String(code) })}
                        className="relative inline-flex h-6 w-6 shrink-0 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform rtl:-scale-x-100", open && "rotate-90 rtl:rotate-90")} />
                      </Link>}
                      <span className="sm:whitespace-nowrap">
                        {code === null ? t("statistics.unknownWilaya") : w.name ? <><bdi dir="ltr">{code}</bdi><span> · </span><bdi>{w.name}</bdi></> : <bdi dir="ltr">{code}</bdi>}
                      </span>
                    </div>
                  </td>
                  <td className="num text-end">
                    {rates.counts.received > 0 && href("received") ? (
                      <Link href={href("received")!} className={DRILL_LINK}>{rates.counts.received}</Link>
                    ) : (
                      rates.counts.received
                    )}
                  </td>
                  <td className="sm:min-w-32"><MetricCell m={rates.confirmation} numHref={href("confirmed")} title={notEnough} /></td>
                  <td className="sm:min-w-32"><MetricCell m={rates.delivery} numHref={href("delivered")} title={notEnough} /></td>
                  <td className="sm:min-w-32"><MetricCell m={rates.return} numHref={href("return")} title={notEnough} /></td>
                </tr>
                {open ? (
                  <tr>
                    <td colSpan={5} id={panelId} className="max-w-0 bg-surface p-0">
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
