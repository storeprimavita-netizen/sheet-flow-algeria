import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { tableClass } from "@/components/field";
import { TeamTabs } from "../team-tabs";

// Tables with an `audit_row()` trigger attached (00002_settings.sql, 00003_products.sql).
const AUDITED_TABLES = [
  "wilaya_fees",
  "settings",
  "fixed_fees",
  "exchange_rates",
  "integration_configs",
  "expenses",
  "product_costs",
] as const;

function diffRows(oldRow: Record<string, unknown> | null, newRow: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow ?? {})]);
  const changes: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    if (key === "updated_at" || key === "created_at") continue;
    const from = oldRow?.[key];
    const to = newRow?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ key, from, to });
  }
  return changes;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const table = typeof sp.table === "string" ? sp.table : "";
  const actor = typeof sp.actor === "string" ? sp.actor : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

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

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));
  const list = rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="audit" />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <Select name="table" defaultValue={table} className="w-48">
          <option value="">{t("common.all")}</option>
          {AUDITED_TABLES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select name="actor" defaultValue={actor} className="w-48">
          <option value="">{t("common.all")}</option>
          {(profiles ?? []).map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.display_name ?? p.user_id}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={from} className="w-40" />
        <Input name="to" type="date" defaultValue={to} className="w-40" />
        <Button type="submit">{t("actions.search")}</Button>
      </form>

      {!list.length ? (
        <Empty>{t("team.auditNone")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.from")}</th>
                  <th>{t("team.table")}</th>
                  <th>{t("team.action")}</th>
                  <th>{t("fields.agent")}</th>
                  <th>{t("team.changes")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const changes = diffRows(
                    r.old_row as Record<string, unknown> | null,
                    r.new_row as Record<string, unknown> | null,
                  );
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</td>
                      <td>{r.table_name}</td>
                      <td className="text-muted-foreground">{r.action}</td>
                      <td>{r.actor ? (nameById.get(r.actor) ?? r.actor) : t("orders.systemActor")}</td>
                      <td className="max-w-md text-xs text-muted-foreground">
                        {changes.length === 0
                          ? "—"
                          : changes
                              .map((c) => `${c.key}: ${JSON.stringify(c.from) ?? "∅"} → ${JSON.stringify(c.to) ?? "∅"}`)
                              .join("; ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
