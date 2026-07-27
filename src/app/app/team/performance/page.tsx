import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDuration } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { TeamTabs } from "../team-tabs";

export default async function PerformancePage() {
  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    supabase.from("agent_performance").select("*").eq("workspace_id", workspaceId),
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));
  const list = (rows ?? []).filter((r) => r.user_id && r.stage);

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="performance" />

      {!list.length ? (
        <Empty>{t("team.performanceNone")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.agent")}</th>
                  <th>{t("team.stage")}</th>
                  <th>{t("team.ordersHandled")}</th>
                  <th>{t("team.rate")}</th>
                  <th>{t("team.lost")}</th>
                  <th>{t("team.avgDecisionTime")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const handled = r.orders_handled ?? 0;
                  const won = r.stage === "delivery" ? (r.delivered ?? 0) : (r.confirmed ?? 0);
                  const rate = handled > 0 ? `${Math.round((won / handled) * 100)}%` : "—";
                  return (
                    <tr key={`${r.user_id}-${r.stage}`}>
                      <td className="font-medium">{nameById.get(r.user_id!) ?? r.user_id}</td>
                      <td className="text-muted-foreground">
                        {r.stage === "delivery" || r.stage === "confirmation"
                          ? t(`team.stageLabel.${r.stage}`)
                          : r.stage}
                      </td>
                      <td>{handled}</td>
                      <td>{rate}</td>
                      <td>{r.lost ?? 0}</td>
                      <td className="text-muted-foreground">{formatDuration(r.avg_decision_time)}</td>
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
