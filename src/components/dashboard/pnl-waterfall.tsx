import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PnlLines } from "@/lib/pricing";

export type WaterfallLabels = Record<
  "revenue" | "cogs" | "returns" | "ads" | "expenses" | "fixed" | "net",
  string
>;

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
  const costs: [keyof WaterfallLabels, number][] = [
    ["cogs", pnl.cogs],
    ["returns", pnl.return_fees],
    ["ads", pnl.ad_spend],
    ["expenses", pnl.expenses],
    ["fixed", pnl.fixed_fees],
  ];

  type Step = { key: keyof WaterfallLabels; from: number; to: number; value: number; kind: "rev" | "cost" | "net" };
  const steps: Step[] = [{ key: "revenue", from: 0, to: pnl.revenue, value: pnl.revenue, kind: "rev" }];
  let running = pnl.revenue;
  for (const [key, c] of costs) {
    steps.push({ key, from: running - c, to: running, value: -c, kind: "cost" });
    running -= c;
  }
  steps.push({ key: "net", from: Math.min(0, pnl.net_profit), to: Math.max(0, pnl.net_profit), value: pnl.net_profit, kind: "net" });

  const lo = Math.min(0, ...steps.map((s) => s.from));
  const hi = Math.max(0, ...steps.map((s) => s.to));
  const span = hi - lo || 1;
  const pos = (x: number) => `${((x - lo) / span) * 100}%`;
  const zero = pos(0);

  return (
    <div className="space-y-1.5">
      {steps.map((s) => {
        const href = hrefs[s.key];
        const label = (
          <span className={cn("truncate text-sm", s.kind === "net" ? "font-semibold" : "text-muted-foreground")}>
            {labels[s.key]}
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
