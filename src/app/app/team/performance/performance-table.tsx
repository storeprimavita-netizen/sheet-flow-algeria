"use client";

import { useTranslations } from "next-intl";

import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { RateCell } from "@/components/stats/rate-bar";
import { formatDuration } from "@/lib/format";

export type PerfRow = {
  user_id: string;
  name: string;
  stage: "confirmation" | "delivery";
  orders_handled: number;
  won: number;
  rate: number | null;
  lost: number;
  avg_decision_time: string | null;
};

export function PerformanceTable({ rows }: { rows: PerfRow[] }) {
  const t = useTranslations();

  const columns: Column<PerfRow>[] = [
    { id: "agent", header: t("fields.agent"), sticky: true, sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      id: "stage",
      header: t("team.stage"),
      cell: (r) => <span className="text-muted-foreground">{t(`team.stageLabel.${r.stage}`)}</span>,
    },
    { id: "handled", header: t("team.ordersHandled"), numeric: true, sortable: true, cell: (r) => r.orders_handled },
    {
      id: "rate",
      header: t("team.rate"),
      sortable: true,
      cell: (r) => (r.rate == null ? "—" : <RateCell pct={r.rate} label={`${r.rate}%`} />),
    },
    { id: "lost", header: t("team.lost"), numeric: true, cell: (r) => r.lost },
    {
      id: "avg_decision_time",
      header: t("team.avgDecisionTime"),
      cell: (r) => <span className="text-muted-foreground">{formatDuration(r.avg_decision_time)}</span>,
    },
  ];

  return (
    <DataTable<PerfRow>
      tableId="team-performance"
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.user_id}-${r.stage}`}
      empty={{ title: t("team.performanceNone") }}
    />
  );
}
