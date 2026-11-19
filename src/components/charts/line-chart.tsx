"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { bandAt, compactNumber, lineSegments, linear, niceTicks, thinIndices, xAt } from "@/lib/chart-math";
import { ChartBoundary, ChartPanel, ChartTooltip, LegendItem } from "./chart-panel";
import { markerPath } from "./glyphs";
import type { ChartEmpty, Pt, SeriesStyle } from "./types";
import { useChartNav, useChartWidth, useIsRtl } from "./use-chart";

export type LineX = { key: string; label: string; short: string; immature?: boolean; href?: string };
export type LineSeries = SeriesStyle & {
  values: (number | null)[];
  /** full-precision text for tooltip and table; the axis uses compact numbers */
  format: (v: number) => string;
};
type Props = {
  title: string;
  xs: LineX[];
  series: LineSeries[];
  empty?: ChartEmpty | null;
  note?: React.ReactNode;
  axisFormat?: (v: number) => string;
};

/** The table view of the plot: same formatted numbers, one row per x. */
export function lineTable(title: string, xs: LineX[], series: LineSeries[], noValue: string) {
  return {
    caption: title,
    head: [""].concat(series.map((s) => s.label)),
    rows: xs.map((x, i) => [x.label, ...series.map((s) => (s.values[i] == null ? noValue : s.format(s.values[i] as number)))]),
  };
}

const H = 240;
const M = { top: 12, bottom: 28, left: 8, right: 8 };

/**
 * Time-series lines. Oldest at the right in RTL with the Y axis on the right. A null value is
 * a gap (never 0). The segment into an immature point is dashed. Every point links to `x.href`.
 */
export function LineChart(props: Props) {
  return (
    <ChartBoundary title={props.title}>
      <LineChartInner {...props} />
    </ChartBoundary>
  );
}

function LineChartInner({ title, xs, series, empty, note, axisFormat = compactNumber }: Props) {
  const t = useTranslations("charts");
  const rtl = useIsRtl();
  const n = xs.length;

  const grid: (Pt | null)[][] = series.map((s) =>
    s.values.map((v, i) =>
      v == null
        ? null
        : {
            title: xs[i].label,
            rows: series.map((o) => ({ label: o.label, value: o.values[i] == null ? t("noValue") : o.format(o.values[i] as number), color: o.color, dash: o.dash, marker: o.marker })),
            href: xs[i].href,
            aria: `${xs[i].label}: ${s.label} ${s.format(v)}${xs[i].immature ? `, ${t("immature")}` : ""}`,
          },
    ),
  );
  const nav = useChartNav(grid, rtl);
  const width = useChartWidth(nav.boxRef);

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const dom = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const labelW = 40;
  const left = M.left + (rtl ? 0 : labelW);
  const right = width - M.right - (rtl ? labelW : 0);
  const y = linear(dom.min, dom.max, H - M.bottom, M.top);
  const xsPx = xs.map((_, i) => xAt(i, n, left + 6, right - 6, rtl));
  const labelIdx = thinIndices(n, Math.max(2, Math.floor((right - left) / 56)));
  const immature = xs.map((x) => !!x.immature);
  const showMarkers = n <= 60;

  const tableData = lineTable(title, xs, series, t("noValue"));

  // hovering a column (mouse) shows the first series' point of that day
  const hoverBand = (i: number) => {
    const si = series.findIndex((s) => s.values[i] != null);
    if (si < 0 || nav.pinned) return;
    const el = nav.boxRef.current?.querySelector(`[data-pt="${si}-${i}"]`);
    if (el) nav.show(si, i, el);
  };

  const plot = (
    <div ref={nav.boxRef} className="relative" onKeyDown={nav.onKeyDown}>
      <svg width={width} height={H} role="group" aria-label={title} style={{ touchAction: "pan-y" }} className="block overflow-visible">
        {dom.ticks.map((tk) => (
          <g key={tk}>
            <line x1={left} x2={right} y1={y(tk)} y2={y(tk)} strokeWidth={1} className={tk === 0 ? "stroke-[var(--border-strong)]" : "stroke-[var(--border)]"} />
            <text x={rtl ? right + 6 : left - 6} y={y(tk)} dy="0.32em" textAnchor={rtl ? "start" : "end"} className="fill-[var(--text-muted)] text-[10px]">
              {axisFormat(tk)}
            </text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={xs[i].key} x={xsPx[i]} y={H - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">
            {xs[i].short}
          </text>
        ))}
        {xs.map((x, i) => {
          const b = bandAt(i, n, left, right, rtl);
          return <rect key={x.key} x={b.x - b.w / 2} y={M.top} width={b.w} height={H - M.top - M.bottom} fill="none" pointerEvents="all" onPointerEnter={(e) => { if (e.pointerType === "mouse") hoverBand(i); }} />;
        })}
        {series.map((s, si) => {
          const ys = s.values.map((v) => (v == null ? null : y(v)));
          return (
            <g key={s.key}>
              {lineSegments(xsPx, ys, immature).map((seg, k) => (
                <path key={k} d={seg.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={seg.dashed ? "1 5" : s.dash} opacity={seg.dashed ? 0.7 : 1} />
              ))}
              {s.values.map((v, i) =>
                v == null ? null : (
                  <Link key={xs[i].key} href={xs[i].href ?? "#"} aria-label={grid[si][i]?.aria} className="group outline-none" {...nav.bind(si, i)}>
                    <circle cx={xsPx[i]} cy={y(v)} r={22} fill="none" pointerEvents="all" />
                    {showMarkers ? <path d={markerPath(s.marker, xsPx[i], y(v), 3.5)} fill={s.color} stroke="var(--surface)" strokeWidth={1} /> : null}
                    <circle cx={xsPx[i]} cy={y(v)} r={9} fill="none" strokeWidth={2} className="stroke-[var(--focus)] opacity-0 group-focus-visible:opacity-100" />
                  </Link>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip shown={nav.shown} point={nav.point} pinned={nav.pinned} />
    </div>
  );

  return (
    <ChartPanel
      title={title}
      legend={series.map((s) => <LegendItem key={s.key} label={s.label} color={s.color} dash={s.dash} marker={s.marker} />)}
      plot={plot}
      table={tableData}
      empty={empty}
      note={note}
    />
  );
}
