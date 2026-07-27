import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";

/**
 * One KPI: big tabular number + label, optional delta-vs-previous arrow,
 * optional sparkline, optional drill-through link. Shared by the product Stats
 * tab and the Dashboard (§5) — no parallel implementations.
 */
export function KpiTile({
  label,
  value,
  tone,
  delta,
  spark,
  href,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  /** signed percentage change vs the previous period */
  delta?: number | null;
  spark?: number[];
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {spark && spark.length ? (
          <div className={cn("shrink-0", tone === "danger" ? "text-danger" : "text-success")}>
            <Sparkline data={spark} width={56} height={18} />
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("num text-2xl font-semibold", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "")}>
          {value}
        </span>
        {delta != null && Number.isFinite(delta) ? (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", delta >= 0 ? "text-success" : "text-danger")}>
            {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span className="num">{Math.abs(delta).toFixed(1)}%</span>
          </span>
        ) : null}
      </div>
    </>
  );

  const className = "card-surface block rounded-xl p-4";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-border-strong")}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
