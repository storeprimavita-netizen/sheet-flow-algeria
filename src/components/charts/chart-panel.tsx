"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, ChartNoAxesColumn, RefreshCw, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SeriesKey } from "./glyphs";
import type { ChartEmpty, ChartTableData, Pt } from "./types";

export const CHART_MIN_H = 220;

/** Skeleton at the chart's real height, so nothing jumps when data arrives. */
export function ChartSkeleton({ height = CHART_MIN_H, className }: { height?: number; className?: string }) {
  return (
    <div className={cn("card-surface space-y-3 rounded-xl p-4", className)} aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded-md bg-border" />
      <div className="w-full animate-pulse rounded-md bg-border" style={{ height }} />
    </div>
  );
}

function ChartErrorView({ onRetry, title }: { onRetry: () => void; title: string }) {
  const t = useTranslations("charts");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="card-surface rounded-xl p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm" style={{ minHeight: CHART_MIN_H / 2 }}>
        <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
        <span className="min-w-0 flex-1 text-muted-foreground">{t("error")}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(() => {
              router.refresh();
              onRetry();
            })
          }
        >
          <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}

class Boundary extends React.Component<{ title: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("chart", error);
  }
  render() {
    if (this.state.failed) return <ChartErrorView title={this.props.title} onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}

/** Each chart has its own error boundary: one failing chart never takes the page down. */
export const ChartBoundary = Boundary;

export function LegendItem({ label, color, dash, marker, value }: { label: React.ReactNode; color: string; dash?: string; marker?: import("./types").Marker; value?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <SeriesKey color={color} dash={dash} marker={marker} />
      <span className="min-w-0 truncate">{label}</span>
      {value != null ? <span className="num ms-1 whitespace-nowrap text-foreground">{value}</span> : null}
    </li>
  );
}

export function ChartTable({ data }: { data: ChartTableData }) {
  const long = data.rows.length > 90;
  return (
    <div className={cn("overflow-x-auto", long && "max-h-80 overflow-y-auto")}>
      <table className="w-full text-sm">
        <caption className="sr-only">{data.caption}</caption>
        <thead className={cn("text-xs text-muted-foreground", long && "sticky top-0 bg-card")}>
          <tr>
            {data.head.map((h, i) => (
              <th key={i} scope="col" className={cn("px-2 py-1.5 font-medium", i === 0 ? "text-start" : "text-end")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, ri) => (
            <tr key={ri} className="border-t border-border">
              {r.map((c, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="px-2 py-1.5 text-start font-normal">
                    <bdi>{c}</bdi>
                  </th>
                ) : (
                  <td key={ci} dir="ltr" className="num px-2 py-1.5 text-end">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The card around every chart: title, legend, plot/table toggle, empty state, error boundary. */
export function ChartPanel({
  title,
  legend,
  plot,
  table,
  empty,
  note,
  className,
  minHeight = CHART_MIN_H,
}: {
  title: string;
  legend?: React.ReactNode;
  plot: React.ReactNode;
  table?: ChartTableData;
  empty?: ChartEmpty | null;
  note?: React.ReactNode;
  className?: string;
  minHeight?: number;
}) {
  const t = useTranslations("charts");
  const [view, setView] = React.useState<"plot" | "table">("plot");
  const showTable = view === "table" && !!table && !empty;
  return (
    <Boundary title={title}>
      <section className={cn("card-surface flex min-w-0 flex-col gap-3 rounded-xl p-4", className)} aria-label={title}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {table && !empty ? (
            <Button type="button" variant="ghost" size="sm" aria-pressed={showTable} onClick={() => setView(showTable ? "plot" : "table")}>
              {showTable ? <ChartNoAxesColumn className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {t("table")}
            </Button>
          ) : null}
        </div>
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground" style={{ minHeight }}>
            <p>{empty.title}</p>
            {empty.action ? (
              <Link href={empty.action.href} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
                {empty.action.label}
              </Link>
            ) : null}
          </div>
        ) : showTable ? (
          <ChartTable data={table} />
        ) : (
          <>
            {legend ? <ul className="flex flex-wrap gap-x-4 gap-y-1">{legend}</ul> : null}
            <div style={{ minHeight }}>{plot}</div>
          </>
        )}
        {note && !empty ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </section>
    </Boundary>
  );
}

/** Tooltip anchored above (or below near the top) the shown element; clamped so it never clips at 390px. */
export function ChartTooltip({
  shown,
  point,
  pinned,
}: {
  shown: { x: number; y: number; h?: number; width: number } | null;
  point: Pt | null;
  pinned: boolean;
}) {
  const t = useTranslations("charts");
  const ref = React.useRef<HTMLDivElement>(null);
  const [dy, setDy] = React.useState(0);
  const below = !!shown && shown.y < 150;
  // keep the tooltip inside the plot box (its offset parent): measure, then shift back in
  React.useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !box) return;
    const h = el.offsetHeight;
    const top = el.offsetTop - dy - (below ? 0 : h); // translate(-100%) is not part of offsetTop
    const lo = top < 0 ? -top : 0;
    const hi = top + h > box.clientHeight ? box.clientHeight - (top + h) : 0;
    const next = lo || hi;
    setDy((d) => (d === next ? d : next));
  });
  if (!shown || !point) return null;
  const half = 100;
  const left = Math.min(Math.max(shown.x, half + 4), Math.max(shown.width - half - 4, half + 4));
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-10 w-max max-w-[200px] rounded-lg border border-border-strong bg-popover px-3 py-2 text-xs shadow-[var(--shadow-raised)]",
        !pinned && "pointer-events-none",
      )}
      style={{ left, top: (below ? shown.y + (shown.h ?? 18) + 6 : shown.y - 6) + dy, transform: below ? "translateX(-50%)" : "translate(-50%, -100%)" }}
    >
      <p className="mb-1 font-medium">
        <bdi>{point.title}</bdi>
      </p>
      <ul className="space-y-0.5">
        {point.rows.map((r, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {r.color ? <SeriesKey color={r.color} dash={r.dash} marker={r.marker} /> : null}
            <span className="min-w-0 flex-1 text-muted-foreground">
              <bdi>{r.label}</bdi>
            </span>
            <span className="num whitespace-nowrap text-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
      {point.href && pinned ? (
        <Link href={point.href} className="mt-1 flex min-h-11 items-center font-medium text-primary hover:underline">
          {t("viewOrders")}
        </Link>
      ) : null}
    </div>
  );
}

/** Error card for a chart whose server-side query failed: reason + retry (router.refresh). */
export function ChartLoadError({ title }: { title: string }) {
  return <ChartErrorView title={title} onRetry={() => undefined} />;
}
