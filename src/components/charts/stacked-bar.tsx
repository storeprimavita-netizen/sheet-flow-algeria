"use client";

import Link from "next/link";

import { ChartBoundary, ChartPanel, ChartTooltip } from "./chart-panel";
import { shareLegend, shareOf, shareTable, type ShareSlice } from "./share-parts";
import type { ChartEmpty, Pt } from "./types";
import { useChartNav, useIsRtl } from "./use-chart";

type Props = {
  title: string;
  slices: ShareSlice[];
  head: [string, string, string];
  empty?: ChartEmpty | null;
  note?: React.ReactNode;
};

/** One horizontal stacked bar (e.g. the cost breakdown). Starts at the inline start, so RTL fills leftward. */
export function StackedBar(props: Props) {
  return (
    <ChartBoundary title={props.title}>
      <StackedInner {...props} />
    </ChartBoundary>
  );
}

function StackedInner({ title, slices, head, empty, note }: Props) {
  const rtl = useIsRtl();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  const grid: (Pt | null)[][] = [
    shown.map((s) => ({ title: s.label, rows: [{ label: head[1], value: s.display }, { label: head[2], value: shareOf(s.value, total) }], href: s.href, aria: `${s.label}: ${s.display}, ${shareOf(s.value, total)}` })),
  ];
  const nav = useChartNav(grid, rtl);
  const plot = (
    <div ref={nav.boxRef} className="relative" onKeyDown={nav.onKeyDown}>
      <div role="group" aria-label={title} className="flex h-11 w-full gap-0.5 overflow-hidden rounded-md" style={{ touchAction: "pan-y" }}>
        {shown.map((s, i) => (
          <Link
            key={s.key}
            href={s.href ?? "#"}
            aria-label={grid[0][i]?.aria}
            className="block h-full min-w-[6px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
            {...nav.bind(0, i)}
          />
        ))}
      </div>
      <ChartTooltip shown={nav.shown} point={nav.point} pinned={nav.pinned} />
    </div>
  );
  return <ChartPanel title={title} plot={plot} legend={shareLegend(slices, total)} table={shareTable(title, head, slices, total)} empty={empty} note={note} minHeight={44} />;
}
