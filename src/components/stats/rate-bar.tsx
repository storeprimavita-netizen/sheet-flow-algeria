import { cn } from "@/lib/utils";

/** Success/warning/danger threshold bar for a 0-100 rate — shared by every
 * confirmation/delivery rate cell (wilaya, per-agent, per-product tables). */
export function RateBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-raised">
      <div
        className={cn("h-full rounded-full", clamped >= 70 ? "bg-success" : clamped >= 40 ? "bg-warning" : "bg-danger")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** RateBar + its text label, the shape every rate table cell renders. */
export function RateCell({ pct, label, labelWidth = "w-10" }: { pct: number; label: string; labelWidth?: string }) {
  return (
    <div className="flex items-center gap-2">
      <RateBar pct={pct} />
      <span className={cn("num shrink-0 text-end text-xs", labelWidth)}>{label}</span>
    </div>
  );
}
