import Link from "next/link";

import { kpiPct, type KpiMetric } from "@/lib/kpi";
import { RateCell } from "@/components/stats/rate-bar";

/** Drill links stay visibly links on touch (no hover): subtle persistent underline + keyboard focus ring. */
export const DRILL_LINK =
  "underline decoration-border underline-offset-2 hover:decoration-current rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One rate cell from a SQL metric: percent, visible num/den (num links to its orders when `numHref`).
 * An unmatured rate renders neutral (see RateBar) with `title` as the reason. */
export function MetricCell({ m, numHref, title }: { m: KpiMetric; numHref?: string; title: string }) {
  const pct = kpiPct(m);
  const numNode = numHref && m.num > 0 ? <Link href={numHref} className={DRILL_LINK}>{m.num}</Link> : m.num;
  return (
    <RateCell
      pct={pct ?? 0}
      label={pct === null ? "—" : `${pct}%`}
      labelWidth="sm:w-14"
      compact
      matured={m.matured && pct !== null}
      title={m.matured ? undefined : title}
      sub={<>{numNode}/{m.den}</>}
    />
  );
}
