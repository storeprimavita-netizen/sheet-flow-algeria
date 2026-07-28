import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { Empty } from "@/components/empty";

/**
 * Composition of spend by category — horizontal bars sorted by value, each
 * with its DZD amount in the legend (components.md: "legends carry values,
 * not just colors"). Each row drills to Finance → Expenses filtered to it.
 */
export function CategoryBars({
  rows,
  hrefFor,
  emptyLabel,
}: {
  rows: { category: string; label: string; amount_dzd: number }[];
  hrefFor: (category: string) => string;
  emptyLabel: string;
}) {
  if (!rows.length) return <Empty>{emptyLabel}</Empty>;
  const sorted = [...rows].sort((a, b) => b.amount_dzd - a.amount_dzd);
  const max = Math.max(...sorted.map((r) => r.amount_dzd), 1);

  return (
    <ul className="space-y-2">
      {sorted.map((r) => (
        <li key={r.category}>
          <Link href={hrefFor(r.category)} className="block space-y-1 hover:opacity-90">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="num font-medium">{formatCurrency(r.amount_dzd)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-info" style={{ width: `${Math.max(2, (100 * r.amount_dzd) / max)}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
