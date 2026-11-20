import { z } from "zod";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "../settings-tabs";
import { AuditFilterBar } from "./audit-filter-bar";
import { diffRows } from "./_lib/diff";
import { AuditTable, type AuditRow } from "./audit-table";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)));

// Tables with an `audit_row()` trigger attached (00002_settings.sql, 00003_products.sql).
const AUDITED_TABLES = [
  "wilaya_fees",
  "settings",
  "fixed_fees",
  "exchange_rates",
  "integration_configs",
  "expenses",
  "product_costs",
  "zr_shipments",
] as const;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Invalid URL values are dropped instead of reaching Postgres (22007 / 22P02).
  const pick = (v: unknown, schema: z.ZodType<string>) => {
    const r = schema.safeParse(v);
    return r.success ? r.data : "";
  };
  const table = pick(sp.table, z.enum(AUDITED_TABLES));
  const actor = pick(sp.actor, z.string().uuid());
  const from = pick(sp.from, DATE);
  const to = pick(sp.to, DATE);

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
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

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
