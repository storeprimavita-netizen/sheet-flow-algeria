import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "../settings-tabs";
import { AuditFilterBar } from "./audit-filter-bar";
import { diffRows } from "./_lib/diff";
import { AUDITED_TABLES, dayStart, nextDayStart, parseAuditParams } from "./_lib/params";
import { AuditTable, type AuditRow } from "./audit-table";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { table, actor, from, to } = parseAuditParams(sp);

  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (table) query = query.eq("table_name", table);
  if (actor) query = query.eq("actor", actor);
  if (from) query = query.gte("created_at", dayStart(from));
  if (to) query = query.lt("created_at", nextDayStart(to));

  const [{ data: rows, error: rowsError }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId),
  ]);
  if (rowsError) throw new Error(`audit_log: ${rowsError.message}`); // error.tsx shows the reason + retry
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));

  const auditRows: AuditRow[] = (rows ?? []).map((r) => {
    const changes = diffRows(r.old_row as Record<string, unknown> | null, r.new_row as Record<string, unknown> | null);
    return {
      id: r.id,
      created_at: r.created_at,
      table_name: r.table_name,
      action: r.action,
      actor_name: r.actor ? (nameById.get(r.actor) ?? r.actor) : t("orders.systemActor"),
      changes,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.tabs.audit")} subtitle={t("settings.auditSubtitle")} />
      <SettingsTabs active="audit" />

      <AuditFilterBar tables={AUDITED_TABLES} actors={profiles ?? []} />
      <AuditTable rows={auditRows} filtered={Boolean(table || actor || from || to)} />
    </div>
  );
}
