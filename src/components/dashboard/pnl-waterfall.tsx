import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PnlLines } from "@/lib/pricing";

export type WaterfallLabels = Record<
  "revenue" | "cogs" | "returns" | "ads" | "expenses" | "fixed" | "net",
  string
>;

export type WaterfallStep = { key: string; label: string; from: number; to: number; value: number; kind: "rev" | "cost" | "net"; href?: string };

/** Running-total steps from revenue through signed-negative costs to net. */
export function buildSteps(revenue: number, costs: { key: string; label: string; value: number; href?: string }[], net: number, labels: { revenue: string; net: string }, hrefs?: { revenue?: string }): WaterfallStep[] {
  const steps: WaterfallStep[] = [{ key: "revenue", label: labels.revenue, from: 0, to: revenue, value: revenue, kind: "rev", href: hrefs?.revenue }];
  let running = revenue;
  for (const c of costs) {
    // c.value is a positive cost amount
    steps.push({ key: c.key, label: c.label, from: running - c.value, to: running, value: -c.value, kind: "cost", href: c.href });
    running -= c.value;
  }
  steps.push({ key: "net", label: labels.net, from: Math.min(0, net), to: Math.max(0, net), value: net, kind: "net" });
  return steps;
}

/**
 * Revenue → each cost line → net, as a horizontal running-total waterfall.
 * Revenue wears the accent, costs are neutral floating segments, net is
 * good/bad toned AND signed (never color alone). Every row drills through.
 * Pure CSS (logical inset), so RTL mirrors for free.
 */
export function PnlWaterfall({
  pnl,
  labels,
  hrefs,
}: {
  pnl: PnlLines;
  labels: WaterfallLabels;
  hrefs: Partial<Record<keyof WaterfallLabels, string>>;
}) {
  const costs = (["cogs", "returns", "ads", "expenses", "fixed"] as const).map((key) => ({
    key,
    label: labels[key],
    value: { cogs: pnl.cogs, returns: pnl.return_fees, ads: pnl.ad_spend, expenses: pnl.expenses, fixed: pnl.fixed_fees }[key],
    href: hrefs[key],
  }));
  return <WaterfallRows steps={buildSteps(pnl.revenue, costs, pnl.net_profit, labels, hrefs)} />;
}

export function WaterfallRows({ steps }: { steps: WaterfallStep[] }) {
  const lo = Math.min(0, ...steps.map((s) => s.from));
  const hi = Math.max(0, ...steps.map((s) => s.to));
  const span = hi - lo || 1;
  const pos = (x: number) => `${((x - lo) / span) * 100}%`;
  const zero = pos(0);

  return (
    <div className="space-y-1.5">
      {steps.map((s) => {
        const href = s.href;
        const label = (
          <span className={cn("truncate text-sm", s.kind === "net" ? "font-semibold" : "text-muted-foreground")}>
            {s.label}
          </span>
        );
        return (
          <div
            key={s.key}
            className={cn("grid grid-cols-[7.5rem_1fr_auto] items-center gap-3", s.kind === "net" && "border-t border-border pt-2")}
          >
            {href ? (
              <Link href={href} className="truncate hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
            <div className="relative h-5">
              {lo < 0 ? <span className="absolute inset-y-0 w-px bg-border-strong" style={{ insetInlineStart: zero }} aria-hidden /> : null}
              <span
                className={cn(
                  "absolute inset-y-0.5 rounded-sm",
                  s.kind === "rev" && "bg-primary",
                  s.kind === "cost" && "bg-muted-foreground/35",
                  s.kind === "net" && (s.value >= 0 ? "bg-success" : "bg-danger"),
                )}
                style={{ insetInlineStart: pos(s.from), width: `max(2px, calc(${pos(s.to)} - ${pos(s.from)}))` }}
              />
            </div>
            <span
              className={cn(
                "num whitespace-nowrap text-end text-sm",
                s.kind === "net" ? (s.value >= 0 ? "font-semibold text-success" : "font-semibold text-danger") : "",
                s.kind === "cost" && "text-muted-foreground",
              )}
            >
              {s.kind === "cost" ? `−${formatCurrency(-s.value)}` : formatCurrency(s.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
