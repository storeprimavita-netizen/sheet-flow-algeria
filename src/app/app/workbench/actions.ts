"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesUpdate } from "@/lib/supabase/database.types";
import { notifyOrderEvent } from "@/lib/slack";
import { isCurrentUserAdmin } from "@/lib/rbac";

export type WorkbenchResult = { ok: true } | { ok: false; error: string };

// outcomes that count as a real dial (customer reached or rang out)
const DIAL_OUTCOMES = new Set(["confirmed", "not_answer", "closed_phone"]);

/**
 * One-tap status move from the workbench. Same stage-guard + audit + Slack flow
 * as the full order form, plus it bumps `confirmation_attempts` each time the
 * agent actually dials the customer. Runs as the session user → RLS + the
 * orders_guard_fields trigger enforce stage ownership.
 */
export async function workbenchAction(params: {
  orderId: string;
  stage: "confirmation" | "delivery";
  status: string;
  comment: string;
  orderNumber: string | null;
}): Promise<WorkbenchResult> {
  const { orderId, stage, status, comment, orderNumber } = params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, confirmation_status, delivery_status, confirmation_attempts")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "not found" };

  const current = stage === "confirmation" ? order.confirmation_status : order.delivery_status;
  const changed = status !== "" && status !== current;

  if (changed) {
    const { error: evErr } = await supabase.from("order_events").insert({
      order_id: orderId,
      stage,
      status,
      comment: comment || null,
    });
    if (evErr) return { ok: false, error: evErr.message };
  }

  const patch: TablesUpdate<"orders"> = { agent_comment: comment || null };
  if (changed) {
    if (stage === "confirmation") patch.confirmation_status = status as Enums<"confirmation_status">;
    else patch.delivery_status = status as Enums<"delivery_status">;
  }
  if (stage === "confirmation" && DIAL_OUTCOMES.has(status)) {
    patch.confirmation_attempts = (order.confirmation_attempts ?? 0) + 1;
  }

  const { error: upErr } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (upErr) return { ok: false, error: upErr.message };

  if (changed) {
    await notifyOrderEvent({ orderNumber, stage, status, comment });
  }

  revalidatePath("/app/workbench");
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
}): Promise<WorkbenchResult> {
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
  revalidatePath("/app/workbench");
  return { ok: true };
}
