"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesUpdate } from "@/lib/supabase/database.types";
import { isCurrentUserAdmin } from "@/lib/rbac";

export type UpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Stage-aware order status update. Just updates `orders` — the DB triggers
 * write order_status_history and enforce stage ownership (RLS + the
 * guard_order_fields trigger: confirmation agents can't touch delivery_status
 * and vice-versa).
 */
export async function updateOrderStatus(params: {
  orderId: string;
  stage: "confirmation" | "delivery";
  status: string;
  comment: string;
}): Promise<UpdateResult> {
  const { orderId, stage, status, comment } = params;
  const supabase = await createClient();

  const patch: TablesUpdate<"orders"> = {};
  if (stage === "confirmation") {
    patch.confirmation_comment = comment || null;
    if (status !== "") patch.confirmation_status = status as Enums<"confirmation_status">;
  } else if (status !== "") {
    patch.delivery_status = status as Enums<"delivery_status">;
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app/orders");
  return { ok: true };
}

/**
 * Admin-only: assign an order to a confirmation and/or delivery agent.
 * `null` clears the assignment. (Organisational only — RLS still scopes reads
 * by stage, not by assignment.)
 */
export async function assignAgents(params: {
  orderId: string;
  confirmationAgent: string | null;
  deliveryAgent: string | null;
}): Promise<UpdateResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      assigned_confirmation_agent: params.confirmationAgent,
      assigned_delivery_agent: params.deliveryAgent,
    })
    .eq("id", params.orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/orders/${params.orderId}`);
  revalidatePath("/app/orders");
  return { ok: true };
}
