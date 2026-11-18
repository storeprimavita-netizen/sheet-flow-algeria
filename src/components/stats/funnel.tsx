import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Stepped funnel: received → confirmed → delivered, each bar widthed by its
 * share of the first stage, with the drop-off % from the previous stage.
 * Shared by the product Stats tab and the Dashboard (§5).
 */
export function Funnel({ stages }: { stages: { label: string; count: number; href?: string; /** index of the stage the drop-off is measured from (default: previous; -1 none) */ dropFrom?: number; /** shown after the drop %, muted, when the basis is not the previous bar */ dropNote?: string }[] }) {
  const top = stages[0]?.count ?? 0;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pctOfTop = top > 0 ? (s.count / top) * 100 : 0;
        const prev = stages[s.dropFrom ?? i - 1]?.count;
        const drop = i > 0 && prev && prev > 0 && prev >= s.count ? ((prev - s.count) / prev) * 100 : null;
        const barColor = drop === null || s.dropNote ? "bg-primary" : drop >= 40 ? "bg-danger" : drop >= 20 ? "bg-warning" : "bg-success";
        const label = (
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="num font-medium">{s.count}</span>
              {drop != null ? (
                s.dropNote ? (
                  <span className="text-xs text-muted-foreground">
                    <span className="num">−{drop.toFixed(1)}%</span> {s.dropNote}
                  </span>
                ) : (
                  <span className="num text-xs text-danger">−{drop.toFixed(1)}%</span>
                )
              ) : null}
            </span>
          </span>
        );
        return (
          <div key={s.label} className="space-y-1">
            {s.href ? (
              <Link href={s.href} className="block hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
            <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(2, pctOfTop)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
