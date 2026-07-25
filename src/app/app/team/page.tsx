import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { TeamManager, type TeamMember } from "./team-manager";

export default async function TeamPage() {
  await requireAdmin();
  const t = await getTranslations();
  const supabase = await createClient();

  // team_directory is a postgres-owned view restricted to admins (is_admin());
  // it joins auth.users + user_roles + team_roles so we can show emails here.
  const { data } = await supabase
    .from("team_directory")
    .select("*")
    .order("email", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      {!data?.length ? (
        <Empty>{t("team.none")}</Empty>
      ) : (
        <TeamManager members={data as TeamMember[]} />
      )}
    </div>
  );
}
