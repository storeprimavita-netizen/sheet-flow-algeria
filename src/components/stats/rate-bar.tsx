import { cn } from "@/lib/utils";

/** Success/warning/danger threshold bar for a 0-100 rate — shared by every
 * confirmation/delivery rate cell (wilaya, per-agent, per-product tables).
 * `matured={false}` (not enough settled orders, SQL `kpi_metric`) draws a neutral
 * bar: a small or unresolved sample is never shown red or green. */
export function RateBar({ pct, matured = true }: { pct: number; matured?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div aria-hidden className="h-2 w-16 overflow-hidden rounded-full bg-surface-raised">
      <div
        className={cn(
          "h-full rounded-full",
          !matured ? "bg-neutral/40" : clamped >= 70 ? "bg-success" : clamped >= 40 ? "bg-warning" : "bg-danger",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** RateBar + its text label, the shape every rate table cell renders. */
export function RateCell({
  pct,
  label,
  labelWidth = "w-10",
  matured = true,
}: {
  pct: number;
  label: string;
  labelWidth?: string;
  matured?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <RateBar pct={pct} matured={matured} />
      <span className={cn("num shrink-0 text-end text-xs", labelWidth)}>{label}</span>
    </div>
  );
}
