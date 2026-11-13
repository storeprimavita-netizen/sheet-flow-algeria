"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { formatCurrency, formatDate } from "@/lib/format";
import { Empty } from "@/components/empty";
import { cn } from "@/lib/utils";

export type DailyPoint = { day: string; revenue_dzd: number; invested_dzd: number };

const WIDTH = 640;
const HEIGHT = 200;
const PAD_L = 64;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

/**
 * Net profit vs invested over the filtered period — answers "is the trend
 * improving". Hand-rolled inline SVG (no recharts in this repo's
 * dependencies; the codebase's own precedent — Sparkline/Funnel — is
 * dependency-free per-chart SVG, so this follows the same rung of the ladder).
 */
export function TimeChart({ daily }: { daily: DailyPoint[] }) {
  const t = useTranslations();

  const points = daily.map((d) => ({
    day: d.day,
    netProfit: d.revenue_dzd - d.invested_dzd,
    invested: d.invested_dzd,
  }));

  const hasData = points.length > 0 && points.some((p) => p.netProfit !== 0 || p.invested !== 0);
  if (!hasData) {
    return <Empty>{t("dashboard.noData")}</Empty>;
  }

  const totalNet = points.reduce((s, p) => s + p.netProfit, 0);
  const totalInvested = points.reduce((s, p) => s + p.invested, 0);
  const netColor = totalNet >= 0 ? "success" : "danger";

  const allValues = points.flatMap((p) => [p.netProfit, p.invested]);
  const max = Math.max(0, ...allValues);
  const min = Math.min(0, ...allValues);
  const span = max - min || 1;

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD_T + innerH - ((v - min) / span) * innerH;
  const zeroY = y(0);

  const path = (key: "netProfit" | "invested") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const firstLabel = formatDate(points[0].day);
  const lastLabel = formatDate(points[points.length - 1].day);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={t("dashboard.timeChart.title")}>
        {/* y-axis labels */}
        <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {formatCurrency(max)}
        </text>
        <text x={PAD_L - 6} y={PAD_T + innerH} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {formatCurrency(min)}
        </text>
        <line x1={PAD_L} y1={zeroY} x2={WIDTH - PAD_R} y2={zeroY} className="stroke-border" strokeWidth={1} strokeDasharray="2,2" />

        <path
          d={path("invested")}
          fill="none"
          className="stroke-danger"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path("netProfit")}
          fill="none"
          className={netColor === "success" ? "stroke-success" : "stroke-danger"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* x-axis labels: first/last day only, keeps it readable at any range length */}
        <text x={PAD_L} y={HEIGHT - 6} textAnchor="start" className="fill-muted-foreground text-[9px]">
          {firstLabel}
        </text>
        <text x={WIDTH - PAD_R} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {lastLabel}
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-0.5 w-3 rounded-full", netColor === "success" ? "bg-success" : "bg-danger")} />
          {t("dashboard.kpi.netProfit")}: <span className="num font-medium">{formatCurrency(totalNet)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-0.5 w-3 rounded-full bg-danger" />
          {t("dashboard.kpi.invested")}: <span className="num font-medium">{formatCurrency(totalInvested)}</span>
        </span>
      </div>
    </div>
  );
}
