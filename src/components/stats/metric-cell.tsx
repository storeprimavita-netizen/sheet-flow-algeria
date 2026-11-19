import Link from "next/link";

import { kpiPct, type KpiMetric } from "@/lib/kpi";
import { RateCell } from "@/components/stats/rate-bar";

/** One rate cell from a SQL metric: percent, visible num/den (num links to its orders when `numHref`).
 * An unmatured rate renders neutral (see RateBar) with `title` as the reason. */
export function MetricCell({ m, numHref, title }: { m: KpiMetric; numHref?: string; title: string }) {
  const pct = kpiPct(m);
  const numNode = numHref && m.num > 0 ? <Link href={numHref} className="underline-offset-2 hover:underline">{m.num}</Link> : m.num;
  return (
    <RateCell
      pct={pct ?? 0}
      label={pct === null ? "—" : `${pct}%`}
      labelWidth="w-14"
      matured={m.matured && pct !== null}
      title={m.matured ? undefined : title}
      sub={<>{numNode}/{m.den}</>}
    />
  );
}
