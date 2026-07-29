import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { TASK_PRIORITIES } from "@/lib/enums";
import { PageHeader } from "@/components/page-header";
import { TeamTabs } from "../team-tabs";
import { TasksView, type TaskRow } from "./tasks-view";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user!.id;

  const ownerFilter = get("owner") || currentUserId; // "My tasks" is the default
  const priorityParam = get("priority");
  const priorityFilter = TASK_PRIORITIES.find((p) => p === priorityParam);
  const productFilter = get("product");
  const overdueOnly = get("due") === "overdue";
  const today = new Date().toISOString().slice(0, 10);

  // `tasks.owner` and `profiles.user_id` are sibling FKs to auth.users (no
  // direct FK between tasks and profiles for PostgREST to embed) — resolve
  // the owner name via a separate profiles query, same pattern
  // meetings/[id]/page.tsx already uses for attendee names.
  let query = supabase
    .from("tasks")
    .select("*, meeting:meetings(title), product:products(name)")
    .eq("workspace_id", workspaceId);
  if (ownerFilter !== "__all") query = query.eq("owner", ownerFilter);
  if (priorityFilter) query = query.eq("priority", priorityFilter);
  if (productFilter) query = query.eq("product_id", productFilter);
  if (overdueOnly) query = query.lt("due_date", today).neq("status", "done");

  const [{ data: tasks }, { data: profiles }, { data: meetings }, { data: products }] = await Promise.all([
    query.order("created_at", { ascending: false }),
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId).eq("is_active", true),
    supabase.from("meetings").select("id, title, scheduled_at").eq("workspace_id", workspaceId).order("scheduled_at", { ascending: false }),
    supabase.from("products").select("id, name, images, status").order("name"),
  ]);
  const nameByOwner = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const rows: TaskRow[] = (tasks ?? []).map((r) => ({
    ...r,
    owner_name: r.owner ? (nameByOwner.get(r.owner) ?? null) : null,
    meeting_title: r.meeting?.title ?? null,
    product_name: r.product?.name ?? null,
  }));

  const productOptions = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="tasks" />

      <TasksView
        rows={rows}
        owners={profiles ?? []}
        meetings={meetings ?? []}
        products={productOptions}
        currentUserId={currentUserId}
      />
    </div>
  );
}
