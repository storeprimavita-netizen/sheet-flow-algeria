"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesUpdate } from "@/lib/supabase/database.types";
import { notifyOrderEvent } from "@/lib/slack";

export type UpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Stage-aware order status update, run server-side so we can also fire the Slack
 * alert. Uses the calling user's session client → RLS + the column-guard trigger
 * enforce exactly what they did on the client (confirmation agents can't touch
 * delivery_status and vice-versa). The audit event is logged BEFORE the flip so
 * the confirmation→confirmed handoff keeps its history.
 */
export async function updateOrderStatus(params: {
  orderId: string;
  stage: "confirmation" | "delivery";
  status: string;
  comment: string;
  orderNumber: string | null;
}): Promise<UpdateResult> {
  const { orderId, stage, status, comment, orderNumber } = params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, confirmation_status, delivery_status")
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

  const { error: upErr } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (upErr) return { ok: false, error: upErr.message };

  if (changed) {
    await notifyOrderEvent({ orderNumber, stage, status, comment });
  }

  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app/orders");
  return { ok: true };
}
