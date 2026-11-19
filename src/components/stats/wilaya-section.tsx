"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { kpiPct } from "@/lib/kpi";
import { drillQs, type DashboardFilters } from "@/lib/query-string";
import { AlgeriaMap, type WilayaMapDatum } from "@/components/dashboard/algeria-map";
import { WilayaTable, type WilayaTableRow } from "@/components/stats/wilaya-table";

/**
 * Per-wilaya table (source of truth for numbers) with the Algeria choropleth
 * below it on narrow screens and beside it from lg. Hover syncs both ways;
 * a map click drills into the wilaya's orders. Unmatured delivery rates are grey.
 */
export function WilayaSection({
  rows,
  filters,
  expanded,
  panel,
  names,
}: {
  rows: WilayaTableRow[];
  filters: DashboardFilters;
  expanded: number | null;
  panel: React.ReactNode;
  names: Record<number, string>;
}) {
  const t = useTranslations("statistics");
  const router = useRouter();
  const [hovered, setHovered] = React.useState<number | null>(null);

  const data: WilayaMapDatum[] = rows.flatMap((w) =>
    w.code === null
      ? []
      : [{ code: w.code, name: w.label, totalOrders: w.rates.counts.received, deliveryRate: kpiPct(w.rates.delivery), matured: w.rates.delivery.matured }],
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
      <div className="card-surface min-w-0 rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("wilayaTitle")}</h2>
        <WilayaTable rows={rows} filters={filters} expanded={expanded} panel={panel} hovered={hovered} onHover={setHovered} />
      </div>

      <div className="card-surface flex flex-col items-center gap-2 rounded-xl p-5 lg:w-[320px]">
        <AlgeriaMap
          data={data}
          hovered={hovered}
          onHover={setHovered}
          onSelect={(code) => router.push(drillQs(filters, { kind: "received", wilaya: code }))}
          label={t("mapLabel")}
          noDataLabel={t("notEnoughData")}
          names={names}
        />
        <div className="grid grid-cols-3 justify-items-start gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-center">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-danger" /><bdi dir="ltr">&lt;40%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange" /><bdi dir="ltr">40–55%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /><bdi dir="ltr">55–70%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-info" /><bdi dir="ltr">70–85%</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success" /><bdi dir="ltr">85%+</bdi></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neutral/30" />{t("notEnoughData")}</span>
        </div>
      </div>
    </div>
  );
}
