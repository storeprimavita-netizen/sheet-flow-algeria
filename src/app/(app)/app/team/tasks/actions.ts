"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/enums";

export type UpdateResult = { ok: true } | { ok: false; error: string };

const nullableUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() && v.trim() !== "__none" ? v.trim() : null),
  z.string().uuid().nullable(),
);
const nullableDate = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable());

const taskSchema = z.object({
  id: nullableUuid,
  title: z.string().trim().min(1),
  owner: nullableUuid,
  due_date: nullableDate,
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  meeting_id: nullableUuid,
  product_id: nullableUuid,
});

/** The one task create/edit action — used by both the kanban card sheet and
 * the list-view sheet (interconnection: one component, two surfaces). */
export async function saveTask(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = taskSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    owner: formData.get("owner"),
    due_date: formData.get("due_date"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    meeting_id: formData.get("meeting_id"),
    product_id: formData.get("product_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  const patch = { workspace_id: workspaceId, ...input };
  const { error } = id
    ? await supabase.from("tasks").update(patch).eq("id", id).eq("workspace_id", workspaceId)
    : await supabase.from("tasks").insert(patch);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/team/tasks");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

/** Quick status change — kanban drag, on-card StatusSelect, list-view StatusSelect. */
export async function updateTaskStatus(id: string, status: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = z.enum(TASK_STATUSES).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: parsed.data }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/team/tasks");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
