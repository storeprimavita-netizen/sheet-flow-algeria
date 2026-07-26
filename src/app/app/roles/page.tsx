import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { PageHeader } from "@/components/page-header";
import { RoleManager, type UserRow } from "./role-manager";

export default async function RolesPage() {
  await requireAdmin("/app/roles");
  const t = await getTranslations();
  const admin = await createAdminClient();
  const supabase = await createClient();

  // full auth-user roster (service-role) + current roles (RLS: all read)
  const [{ data: authData }, { data: roles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleMap = new Map<string, Enums<"app_role">>(
    (roles ?? []).map((r) => [r.user_id, r.role as Enums<"app_role">]),
  );

  const users: UserRow[] = (authData?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      role: roleMap.get(u.id) ?? null,
    }))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  return (
    <div className="space-y-6">
      <PageHeader title={t("roles.title")} subtitle={t("roles.subtitle")} />
      <RoleManager users={users} />
    </div>
  );
}
