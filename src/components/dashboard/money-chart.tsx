"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cumulative } from "@/lib/chart-math";
import { formatCurrency } from "@/lib/format";
import { LineChart, type LineSeries, type LineX } from "@/components/charts/line-chart";

export type MoneyDay = {
  /** ISO day */
  key: string;
  /** dd/mm/yyyy */
  label: string;
  /** dd/mm */
  short: string;
  immature: boolean;
  /** SQL kpi_daily money, shown as is (the only transformation is the running total) */
  revenue: number;
  costs: number;
  net: number;
  href: string;
};

/**
 * Revenue, total costs and net profit per day (SQL `kpi_daily`), with a cumulative toggle
 * and the period total. Three series differ by colour, dash and marker. Recent days are
 * dashed and noted: revenue counts by order date, ads by spend date.
 */
export function MoneyChart({ days, total, emptyAction }: { days: MoneyDay[]; total: string | null; emptyAction: { label: string; href: string } }) {
  const t = useTranslations("dashboard.v2.money.chart");
  const [cum, setCum] = React.useState(false);
  const hasData = days.some((d) => d.revenue !== 0 || d.costs !== 0);

  const xs: LineX[] = days.map((d) => ({ key: d.key, label: d.label, short: d.short, immature: d.immature, href: d.href }));
  const pick = (f: (d: MoneyDay) => number) => {
    const raw = days.map(f);
    return cum ? cumulative(raw) : raw;
  };
  const series: LineSeries[] = [
    { key: "revenue", label: t("revenue"), color: "var(--chart-1)", marker: "circle", values: pick((d) => d.revenue), format: (v) => formatCurrency(v) },
    { key: "costs", label: t("costs"), color: "var(--chart-3)", dash: "6 4", marker: "square", values: pick((d) => d.costs), format: (v) => formatCurrency(v) },
    { key: "net", label: t("net"), color: "var(--chart-2)", dash: "2 3", marker: "diamond", values: pick((d) => d.net), format: (v) => formatCurrency(v) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("periodTotal")} <span className="num font-semibold text-foreground">{total ?? "—"}</span>
        </p>
        <Button type="button" variant="outline" size="sm" aria-pressed={cum} onClick={() => setCum((v) => !v)}>
          <TrendingUp className="h-3.5 w-3.5" />
          {t("cumulative")}
        </Button>
      </div>
      <LineChart
        title={t("title")}
        xs={xs}
        series={series}
        empty={hasData ? null : { title: t("empty"), action: emptyAction }}
        note={days.some((d) => d.immature) ? t("immatureNote") : undefined}
      />
    </div>
  );
}
