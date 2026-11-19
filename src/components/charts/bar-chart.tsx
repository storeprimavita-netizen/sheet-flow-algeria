"use client";

import Link from "next/link";

import { ltr } from "@/lib/format";
import { bandAt, compactNumber, linear, niceTicks, thinIndices } from "@/lib/chart-math";
import { cn } from "@/lib/utils";
import { ChartBoundary, ChartPanel, ChartTooltip } from "./chart-panel";
import type { ChartEmpty, Pt } from "./types";
import { useChartNav, useChartWidth, useIsRtl } from "./use-chart";

export type BarItem = {
  key: string;
  label: string;
  /** short axis label (vertical bars) */
  short?: string;
  value: number;
  /** full text for the value (tooltip, table, row end) */
  display: string;
  /** muted second figure, e.g. "42 orders" */
  sub?: string;
  href?: string;
  /** CSS variable reference; defaults to --chart-1 */
  color?: string;
};
type Props = {
  title: string;
  items: BarItem[];
  orientation?: "v" | "h";
  /** table column header for value / sub */
  valueHead: string;
  subHead?: string;
  empty?: ChartEmpty | null;
  note?: React.ReactNode;
};

const H = 220;
const M = { top: 10, bottom: 26 };

/** Bars, vertical (SVG) or horizontal (HTML rows, grow from the inline start so RTL grows leftward). */
export function BarChart(props: Props) {
  return (
    <ChartBoundary title={props.title}>
      <BarChartInner {...props} />
    </ChartBoundary>
  );
}

function BarChartInner({ title, items, orientation = "v", valueHead, subHead, empty, note }: Props) {
  const rtl = useIsRtl();
  const grid: (Pt | null)[][] = [
    items.map((it) => ({
      title: it.label,
      rows: [{ label: valueHead, value: it.display }, ...(it.sub ? [{ label: subHead ?? "", value: it.sub }] : [])],
      href: it.href,
      aria: `${it.label}: ${it.display}${it.sub ? `, ${it.sub}` : ""}`,
    })),
  ];
  const nav = useChartNav(grid, rtl, orientation === "h" ? "y" : "x");
  const width = useChartWidth(nav.boxRef);
  const tableData = {
    caption: title,
    head: [title, valueHead, ...(subHead ? [subHead] : [])],
    rows: items.map((it) => [it.label, it.display, ...(subHead ? [it.sub ?? ""] : [])]),
  };

  let plot: React.ReactNode;
  if (orientation === "h") {
    const max = Math.max(1, ...items.map((i) => i.value));
    plot = (
      <div ref={nav.boxRef} className="relative w-full min-w-0" onKeyDown={nav.onKeyDown}>
        <div role="group" aria-label={title} className="flex flex-col">
          {items.map((it, i) => (
            <Link
              key={it.key}
              href={it.href ?? "#"}
              aria-label={grid[0][i]?.aria}
              className="grid min-h-11 grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-3 rounded-md px-1 text-sm outline-none hover:bg-border focus-visible:ring-2 focus-visible:ring-ring"
              {...nav.bind(0, i)}
            >
              <span className="truncate text-muted-foreground"><bdi>{it.label}</bdi></span>
              <span className="block h-3 rounded-sm bg-border">
                <span className="block h-full rounded-sm" style={{ width: `${Math.max(it.value > 0 ? 2 : 0, (it.value / max) * 100)}%`, background: it.color ?? "var(--chart-1)" }} />
              </span>
              <span className="num whitespace-nowrap text-end">
                {it.display}
                {it.sub ? <span className="ms-2 text-xs text-muted-foreground">{it.sub}</span> : null}
              </span>
            </Link>
          ))}
        </div>
        <ChartTooltip shown={nav.shown} point={nav.point} pinned={nav.pinned} />
      </div>
    );
  } else {
    const labelW = 40;
    const left = rtl ? 4 : labelW;
    const right = width - (rtl ? labelW : 4);
    const dom = niceTicks(0, Math.max(0, ...items.map((i) => i.value)), 4, true);
    const y = linear(dom.min, dom.max, H - M.bottom, M.top);
    const n = items.length;
    const labelIdx = thinIndices(n, Math.max(2, Math.floor((right - left) / 44)));
    plot = (
      <div ref={nav.boxRef} className="relative w-full min-w-0" onKeyDown={nav.onKeyDown}>
        <svg width={width} height={H} role="group" aria-label={title} style={{ touchAction: "pan-y" }} className="block overflow-visible">
          {dom.ticks.map((tk) => (
            <g key={tk}>
              <line x1={left} x2={right} y1={y(tk)} y2={y(tk)} strokeWidth={1} className={tk === 0 ? "stroke-[var(--border-strong)]" : "stroke-[var(--border)]"} />
              <text x={rtl ? right + 6 : left - 6} y={y(tk)} dy="0.32em" textAnchor={rtl ? "start" : "end"} className="fill-[var(--text-muted)] text-[10px]">
                {ltr(compactNumber(tk))}
              </text>
            </g>
          ))}
          {items.map((it, i) => {
            const b = bandAt(i, n, left, right, rtl);
            const bw = Math.max(3, b.w * 0.7);
            const top = y(it.value);
            const base = y(0);
            return (
              <Link key={it.key} href={it.href ?? "#"} aria-label={grid[0][i]?.aria} className="group outline-none" {...nav.bind(0, i)}>
                <rect x={b.x - Math.max(b.w, 44) / 2} y={M.top} width={Math.max(b.w, 44)} height={H - M.top - M.bottom} fill="none" pointerEvents="all" />
                <rect x={b.x - bw / 2} y={Math.min(top, base)} width={bw} height={Math.max(2, Math.abs(base - top))} rx={2} fill={it.color ?? "var(--chart-1)"} />
                <rect x={b.x - bw / 2 - 2} y={M.top} width={bw + 4} height={H - M.top - M.bottom} rx={3} fill="none" strokeWidth={2} className="stroke-[var(--focus)] opacity-0 group-focus-visible:opacity-100" />
              </Link>
            );
          })}
          {labelIdx.map((i) => (
            <text key={items[i].key} x={bandAt(i, n, left, right, rtl).x} y={H - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">
              {items[i].short ?? items[i].label}
            </text>
          ))}
        </svg>
        <ChartTooltip shown={nav.shown} point={nav.point} pinned={nav.pinned} />
      </div>
    );
  }
  return <ChartPanel className={cn(orientation === "h" && "")} title={title} plot={plot} table={tableData} empty={empty} note={note} minHeight={orientation === "h" ? Math.max(120, items.length * 44) : H} />;
}
