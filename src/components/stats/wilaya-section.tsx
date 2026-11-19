"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { kpiPct } from "@/lib/kpi";
import type { DashboardFilters } from "@/lib/query-string";
import { AlgeriaMap, type WilayaMapDatum } from "@/components/dashboard/algeria-map";
import { WilayaTable, type StatsRow } from "@/components/stats/wilaya-table";

export type { StatsRow };

/**
 * Per-wilaya table (source of truth for numbers) beside the Algeria choropleth
 * (for spotting patterns) — hover syncs both ways, click opens the commune
 * panel. The map stacks below the table on narrow screens.
 */
export function WilayaSection({
  rows,
  filters,
  openWilaya,
  panel,
  names,
}: {
  rows: StatsRow[];
  filters: DashboardFilters;
  openWilaya: number | null;
  panel: React.ReactNode;
  names?: Record<number, string>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [hovered, setHovered] = React.useState<number | null>(null);

  const data: WilayaMapDatum[] = rows.map((r) => ({
    code: r.code,
    name: r.name,
    totalOrders: r.group.rates.counts.received,
    deliveryRate: kpiPct(r.group.rates.delivery),
    matured: r.group.rates.delivery.matured,
  }));

  const open = (code: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("wilaya", String(code));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="card-surface grid grid-cols-1 gap-5 rounded-xl p-5 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <h2 className="mb-3 text-sm font-semibold">{t("dashboard.wilaya.title")}</h2>
        <WilayaTable rows={rows} filters={filters} openWilaya={openWilaya} panel={panel} hovered={hovered} onHover={setHovered} />
      </div>

      <div className="flex flex-col items-center gap-2 lg:w-[280px]">
        <AlgeriaMap
          data={data}
          hovered={hovered}
          onHover={setHovered}
          onSelect={open}
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
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neutral/30" />{t("statistics.notEnoughData")}</span>
        </div>
      </div>
    </div>
  );
}
