import { cn } from "@/lib/utils";

/** Success/warning/danger threshold bar for a 0-100 rate — shared by every
 * confirmation/delivery rate cell (wilaya, per-agent, per-product tables).
 * `matured={false}` (not enough decided orders, see `kpi_metric`) draws a
 * neutral bar: an unmatured rate is never red or green. */
export function RateBar({ pct, matured = true, className }: { pct: number; matured?: boolean; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = !matured ? "bg-neutral/40" : clamped >= 70 ? "bg-success" : clamped >= 40 ? "bg-warning" : "bg-danger";
  return (
    <div className={cn("h-2 w-16 shrink-0 overflow-hidden rounded-full bg-surface-raised", className)}>
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** RateBar + its text label, the shape every rate table cell renders.
 * `sub` is a visible second line (e.g. the num/den the rate comes from). */
export function RateCell({
  pct,
  label,
  labelWidth = "w-10",
  matured = true,
  sub,
  title,
  compact = false,
}: {
  pct: number;
  label: string;
  labelWidth?: string;
  matured?: boolean;
  sub?: React.ReactNode;
  title?: string;
  /** below `sm`: no bar, label auto-width (narrow tables) */
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2" title={title}>
      <RateBar pct={pct} matured={matured} className={compact ? "max-sm:hidden" : undefined} />
      <span className={cn("num shrink-0 text-end text-xs", labelWidth, !matured && "text-muted-foreground")}>
        {sub ? <bdi dir="ltr">{label}</bdi> : label}
        {sub ? <span className="block text-[11px] text-muted-foreground"><bdi dir="ltr">{sub}</bdi></span> : null}
      </span>
    </div>
  );
}
