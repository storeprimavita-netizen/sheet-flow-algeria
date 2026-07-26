import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireAdminProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { TeamTabs } from "./team-tabs";
import { InviteForm } from "./invite-form";
import { UserRow } from "./user-row";

export default async function TeamPage() {
  await requireAdmin(); // acceptance: agents redirect away from /app/team (rules is the one linked exception)
  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, duty, role, is_active")
    .eq("workspace_id", workspaceId)
    .order("created_at");

  // profiles has no email column (auth.users only) — service role is the
  // documented exception for this (CLAUDE.md: admin.ts "webhooks, invites").
  // ponytail: single listUsers() page, add pagination if the team passes ~1000.
  const admin = await createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(usersPage?.users.map((u) => [u.id, u.email ?? ""]) ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="users" />
      <InviteForm />

      {!profiles?.length ? (
        <Empty>{t("team.none")}</Empty>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.email")}</th>
                  <th>{t("team.duty")}</th>
                  <th>{t("fields.type")}</th>
                  <th>{t("team.active")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <UserRow key={p.user_id} profile={p} email={emailById.get(p.user_id) ?? ""} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
