import Link from "next/link";

import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";
import { TOKEN_DOT_CLASS } from "@/components/ui/chip";
import { Empty } from "@/components/empty";
import { getStatus, type StatusKind } from "@/lib/statuses";

/**
 * Distribution of orders across every value of one status field (how many
 * are in each confirmation/delivery status right now) — the funnel only
 * shows the four pipeline stages, not every terminal/branch status. Each bar
 * drills through to the matching filtered orders list.
 */
export function StatusBreakdownBars({
  kind,
  rows,
  emptyLabel,
  hrefFor,
}: {
  kind: StatusKind;
  rows: { status: string; count: number }[];
  emptyLabel: string;
  hrefFor: (status: string) => string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <Empty>{emptyLabel}</Empty>;
  const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((r) => r.count), 1);

  return (
    <ul className="space-y-2">
      {sorted.map((r) => {
        const token = getStatus(kind, r.status)?.token ?? "neutral";
        return (
          <li key={r.status} className="space-y-1">
            <Link href={hrefFor(r.status)} className="block space-y-1 hover:opacity-90">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <StatusPill kind={kind} status={r.status} size="sm" />
                <span className="num font-medium">{r.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                <div className={cn("h-full rounded-full", TOKEN_DOT_CLASS[token])} style={{ width: `${Math.max(2, (100 * r.count) / max)}%` }} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
