"use client";

import { useTranslations } from "next-intl";

import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatDateTime } from "@/lib/format";
import type { DiffChange, DiffValue } from "./_lib/diff";

export type AuditRow = {
  id: number;
  created_at: string;
  table_name: string;
  action: string;
  actor_name: string;
  changes: DiffChange[];
};

function Value({ v, label, pill }: { v: DiffValue; label: string; pill: string }) {
  if (!v.redacted) return <>{v.text}</>;
  return (
    <span
      role="note"
      dir="ltr"
      tabIndex={0}
      title={label}
      aria-label={`${pill} ${v.fingerprint}. ${label}`}
      className="inline-block rounded border border-border bg-secondary px-1"
    >
      {pill} <bdi dir="ltr" className="font-mono">{v.fingerprint}</bdi>
    </span>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations();

  const columns: Column<AuditRow>[] = [
    { id: "created_at", header: t("fields.date"), sticky: true, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</span> },
    { id: "table", header: t("team.table"), cell: (r) => r.table_name },
    { id: "action", header: t("team.action"), cell: (r) => <span className="text-muted-foreground">{r.action}</span> },
    { id: "actor", header: t("fields.agent"), cell: (r) => r.actor_name },
    { id: "changes", header: t("team.changes"), cell: (r) => r.changes.length === 0 ? "—" : (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {r.changes.map((c) => (
            <li key={c.key} className="text-start">
              <bdi dir="ltr" className="inline-block">
                {c.key}: <Value v={c.from} label={t("audit.redacted")} pill={t("audit.redactedPill")} /> → <Value v={c.to} label={t("audit.redacted")} pill={t("audit.redactedPill")} />
              </bdi>
            </li>
          ))}
        </ul>
      ) },
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
