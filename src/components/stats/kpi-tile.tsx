import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One KPI: big tabular number + label, optional delta-vs-previous arrow,
 * optional sparkline, optional drill-through link, optional formula hint
 * (ⓘ tooltip — every money card says how it's computed). Shared by the
 * product Stats tab and the Dashboard — no parallel implementations.
 */
export function KpiTile({
  label,
  value,
  tone,
  delta,
  goodWhen = "up",
  spark,
  href,
  hint,
  sub,
  icon: Icon,
  hero,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "success" | "danger";
  /** signed percentage change vs the previous period */
  delta?: number | null;
  /** costs go "down" — a rising cost is red */
  goodWhen?: "up" | "down";
  spark?: number[];
  href?: string;
  /** formula, shown in a tooltip */
  hint?: string;
  /** one muted line under the value (e.g. "break-even 48%") */
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** the dashboard's lead number — larger figure */
  hero?: boolean;
  className?: string;
}) {
  const good = delta != null && (goodWhen === "up" ? delta >= 0 : delta <= 0);
  const inner = (
    <>
      <div className={cn("flex items-center justify-between gap-2", hint && "pe-6")}>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="truncate">{label}</span>
        </div>
        {spark && spark.length ? (
          <div className={cn("shrink-0", tone === "danger" ? "text-danger" : "text-success")}>
            <Sparkline data={spark} width={56} height={18} />
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "num whitespace-nowrap font-semibold",
            hero ? "text-4xl tracking-tight md:text-5xl" : "text-2xl",
            tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "",
          )}
        >
          {value}
        </span>
        {delta != null && Number.isFinite(delta) ? (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-success" : "text-danger")}>
            {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span className="num">{Math.abs(delta).toFixed(1)}%</span>
          </span>
        ) : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </>
  );

  const base = cn("card-surface relative block rounded-xl p-4", className);
  const hintIcon = hint ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={hint}
          className="absolute end-1.5 top-2 rounded-md p-2 text-faint hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{hint}</TooltipContent>
    </Tooltip>
  ) : null;

  return href ? (
    <div className={cn(base, "p-0", hero && "flex")}>
      <Link href={href} className={cn("block rounded-xl p-4 transition-colors hover:bg-surface-raised/40", hero && "flex flex-1 flex-col justify-center")}>
        {inner}
      </Link>
      {hintIcon}
    </div>
  ) : (
    <div className={cn(base, hero && "flex flex-col justify-center")}>
      {inner}
      {hintIcon}
    </div>
  );
}
