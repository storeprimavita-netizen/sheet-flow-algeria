"use client";

import { useTranslations } from "next-intl";

import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatDateTime } from "@/lib/format";
import { REDACTED_DISPLAY } from "@/lib/audit-redact";

export type AuditRow = {
  id: number;
  created_at: string;
  table_name: string;
  action: string;
  actor_name: string;
  changes: string;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations();

  const columns: Column<AuditRow>[] = [
    { id: "created_at", header: t("fields.date"), sticky: true, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</span> },
    { id: "table", header: t("team.table"), cell: (r) => r.table_name },
    { id: "action", header: t("team.action"), cell: (r) => <span className="text-muted-foreground">{r.action}</span> },
    { id: "actor", header: t("fields.agent"), cell: (r) => r.actor_name },
    { id: "changes", header: t("team.changes"), cell: (r) => <span className="text-xs text-muted-foreground">
          {r.changes.split(/(\[redacted · [0-9a-f]{8}\])/).map((part, i) =>
            new RegExp(REDACTED_DISPLAY.source).test(part) ? (
              <span key={i} className="rounded bg-muted px-1 font-mono" dir="ltr" title={t("audit.redacted")}>{part}</span>
            ) : (
              part
            ),
          )}
        </span> },
  ];

  return (
    <DataTable<AuditRow>
      tableId="team-audit"
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      empty={{ title: t("team.auditNone") }}
    />
  );
}
