import { AlertTriangle } from "lucide-react";

/**
 * One cell of the break-even rows. D52: "—" means an INPUT is missing,
 * "Not possible" means the product cannot break even at any value. Presentational
 * (labels come in as props) so it is the single place both states are drawn.
 */
export type PricingCellState = "value" | "missing" | "impossible";

export function PricingCell({
  state,
  children,
  missingLabel,
  impossibleLabel,
}: {
  state: PricingCellState;
  children?: React.ReactNode;
  missingLabel: string;
  impossibleLabel: string;
}) {
  if (state === "missing") {
    return (
      <span title={missingLabel} aria-label={missingLabel} className="num text-muted-foreground">
        —
      </span>
    );
  }
  if (state === "impossible") {
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{impossibleLabel}</span>
      </span>
    );
  }
  return <span className="num">{children}</span>;
}
