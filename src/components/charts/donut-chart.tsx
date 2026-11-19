"use client";

import Link from "next/link";

import { arcPath } from "@/lib/chart-math";
import { ChartBoundary, ChartPanel, ChartTooltip } from "./chart-panel";
import { shareLegend, shareOf, shareTable, type ShareSlice } from "./share-parts";
import type { ChartEmpty, Pt } from "./types";
import { useChartNav, useIsRtl } from "./use-chart";

type Props = {
  title: string;
  /** at most 5 slices incl. "Other" (collapseSlices) */
  slices: ShareSlice[];
  totalLabel: string;
  totalDisplay: string;
  head: [string, string, string];
  empty?: ChartEmpty | null;
  note?: React.ReactNode;
};

const S = 200;
const GAP = 0.008;

/** Share donut: gaps between slices, legend with values and %, every slice drills. */
export function DonutChart(props: Props) {
  return (
    <ChartBoundary title={props.title}>
      <DonutInner {...props} />
    </ChartBoundary>
  );
}

function DonutInner({ title, slices, totalLabel, totalDisplay, head, empty, note }: Props) {
  const rtl = useIsRtl();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const grid: (Pt | null)[][] = [
    slices.map((s) => ({ title: s.label, rows: [{ label: head[1], value: s.display }, { label: head[2], value: shareOf(s.value, total) }], href: s.href, aria: `${s.label}: ${s.display}, ${shareOf(s.value, total)}` })),
  ];
  const nav = useChartNav(grid, rtl);
  let acc = 0;
  const plot = (
    <div ref={nav.boxRef} className="relative mx-auto" style={{ width: S }} onKeyDown={nav.onKeyDown}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="group" aria-label={title} className="block" style={{ touchAction: "pan-y" }}>
        {slices.map((s, i) => {
          const t0 = acc / total;
          acc += s.value;
          const t1 = acc / total;
          const single = slices.length === 1;
          const d = arcPath(S / 2, S / 2, 62, 94, single ? t0 : t0 + GAP / 2, single ? t1 : Math.max(t0 + GAP / 2 + 0.002, t1 - GAP / 2));
          return (
            <Link key={s.key} href={s.href ?? "#"} aria-label={grid[0][i]?.aria} className="group outline-none" {...nav.bind(0, i)}>
              <path d={d} fill={s.color} className="group-focus-visible:stroke-[var(--focus)]" strokeWidth={3} stroke="none" />
            </Link>
          );
        })}
        <text x={S / 2} y={S / 2 - 4} textAnchor="middle" className="fill-[var(--text)] text-lg font-semibold">{totalDisplay}</text>
        <text x={S / 2} y={S / 2 + 14} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">{totalLabel}</text>
      </svg>
      <ChartTooltip shown={nav.shown} point={nav.point} pinned={nav.pinned} />
    </div>
  );
  return <ChartPanel title={title} plot={plot} legend={shareLegend(slices, total)} table={shareTable(title, head, slices, total)} empty={empty} note={note} />;
}
