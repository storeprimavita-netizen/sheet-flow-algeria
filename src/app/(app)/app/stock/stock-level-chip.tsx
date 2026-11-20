import { Chip } from "@/components/ui/chip";

/** Stock level chip: count plus Out / Low. Thresholds are computed by the caller. */
export function StockLevelChip({
  stock,
  isOut,
  isLow,
  labels,
}: {
  stock: number;
  isOut: boolean;
  isLow: boolean;
  labels: { out: string; low: string };
}) {
  return (
    <Chip token={isOut ? "danger" : isLow ? "warning" : "neutral"} size="sm" className="whitespace-nowrap">
      <span className="num">{stock}</span>
      {isOut ? ` · ${labels.out}` : isLow ? ` · ${labels.low}` : ""}
    </Chip>
  );
}
