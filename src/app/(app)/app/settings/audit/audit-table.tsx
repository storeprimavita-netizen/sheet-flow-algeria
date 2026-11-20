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

function Value({ v }: { v: DiffValue }) {
  const t = useTranslations();
  if (!v.redacted) return <bdi>{v.text}</bdi>;
  return (
    <span
      role="note"
      tabIndex={0}
      title={t("audit.redacted")}
      aria-label={t("audit.redactedAria", { fp: v.fingerprint ?? "" })}
      className="inline-block whitespace-nowrap rounded border border-border bg-secondary px-1"
    >
      {t("audit.redactedPill")} <bdi dir="ltr" className="font-mono">{v.fingerprint}</bdi>
    </span>
  );
}

export function ChangeList({ changes }: { changes: DiffChange[] }) {
  const t = useTranslations();
  return (
    <ul className="space-y-1 py-2 text-xs text-muted-foreground">
      {changes.map((c) => (
        <li key={c.id} dir="ltr" className="text-start">
          <bdi className="break-all">{c.key === "" ? t("audit.emptyKey") : c.key}</bdi>: <Value v={c.from} /> → <Value v={c.to} />
        </li>
      ))}
    </ul>
  );
}

export function AuditTable({ rows, filtered = false }: { rows: AuditRow[]; filtered?: boolean }) {
  const t = useTranslations();

  // Below sm the changes stack under the table name (the table scrolls sideways otherwise and hides them).
  const columns: Column<AuditRow>[] = [
    { id: "created_at", header: t("fields.date"), sticky: true, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</span> },
    { id: "table", header: t("team.table"), cell: (r) => (
        <>
          {r.table_name}
          <div className="text-xs text-muted-foreground sm:hidden">{r.action} · {r.actor_name}</div>
          {r.changes.length > 0 ? <div className="sm:hidden"><ChangeList changes={r.changes} /></div> : null}
        </>
      ) },
    { id: "action", width: "hidden sm:table-cell", header: t("team.action"), cell: (r) => <span className="text-muted-foreground">{r.action}</span> },
    { id: "actor", width: "hidden sm:table-cell", header: t("fields.agent"), cell: (r) => r.actor_name },
    { id: "changes", width: "hidden sm:table-cell", header: t("team.changes"), cell: (r) => r.changes.length === 0 ? "—" : <div className="hidden sm:block"><ChangeList changes={r.changes} /></div> },
  ];

  return (
    <DataTable<AuditRow>
      tableId="team-audit"
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      empty={{
        title: filtered ? t("team.auditNoMatch") : t("team.auditNone"),
      }}
    />
  );
}
