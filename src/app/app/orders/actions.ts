"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesUpdate } from "@/lib/supabase/database.types";
import { isCurrentUserAdmin, requireAdminProfile as adminProfile } from "@/lib/rbac";
import { upsertCustomerFromOrder } from "@/lib/customers";
import {
  CONFIRMATION_STATUSES,
  DELIVERY_STATUSES,
  DELIVERY_TYPES,
  DELIVERY_FEE_SOURCES,
} from "@/lib/enums";

export type UpdateResult = { ok: true } | { ok: false; error: string };

const optionalText = z.string().trim().optional().transform((v) => v || null);

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

// ---------------------------------------------------------------------------
// Confirmation queue — plain server-action forms (Settings/Products pattern).
// RLS + the guard trigger enforce who can touch what; these just submit.
// ---------------------------------------------------------------------------
const confirmationSchema = z.object({
  status: z.enum(CONFIRMATION_STATUSES),
  comment: optionalText,
});

export async function updateConfirmationStatus(orderId: string, formData: FormData) {
  const input = confirmationSchema.parse({
    status: formData.get("status"),
    comment: formData.get("comment"),
  });
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ confirmation_status: input.status, confirmation_comment: input.comment })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/orders/confirmation");
  revalidatePath(`/app/orders/${orderId}`);
}

// ponytail: read-then-write increment (fine at this volume — one agent
// dialing one order at a time); switch to a `current_fx_rate`-style RPC
// if concurrent dials on the same order ever become a real race.
export async function logConfirmationAttempt(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("confirmation_attempts")
    .eq("id", orderId)
    .single();
  const { error } = await supabase
    .from("orders")
    .update({ confirmation_attempts: (data?.confirmation_attempts ?? 0) + 1 })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/orders/confirmation");
  revalidatePath(`/app/orders/${orderId}`);
}

// ---------------------------------------------------------------------------
// Delivery queue
// ---------------------------------------------------------------------------
const deliverySchema = z.object({ status: z.enum(DELIVERY_STATUSES) });

export async function updateDeliveryStatus(orderId: string, formData: FormData) {
  const input = deliverySchema.parse({ status: formData.get("status") });
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ delivery_status: input.status })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/orders/delivery");
  revalidatePath(`/app/orders/${orderId}`);
}

// ---------------------------------------------------------------------------
// Manual order creation (admin) — customer snapshot upserts `customers`.
// ---------------------------------------------------------------------------
const createOrderSchema = z.object({
  product_id: z.string().uuid(),
  variant: optionalText,
  quantity: z.coerce.number().int().min(1),
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().min(1),
  wilaya_code: z.coerce.number().int(),
  commune: optionalText,
  address: optionalText,
  delivery_type: z.enum(DELIVERY_TYPES),
  sale_price: z.coerce.number().min(0),
  delivery_fee: z.coerce.number().min(0),
  delivery_fee_source: z.enum(DELIVERY_FEE_SOURCES),
});

export async function createOrder(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = createOrderSchema.parse({
    product_id: formData.get("product_id"),
    variant: formData.get("variant"),
    quantity: formData.get("quantity"),
    customer_name: formData.get("customer_name"),
    customer_phone: formData.get("customer_phone"),
    wilaya_code: formData.get("wilaya_code"),
    commune: formData.get("commune"),
    address: formData.get("address"),
    delivery_type: formData.get("delivery_type"),
    sale_price: formData.get("sale_price"),
    delivery_fee: formData.get("delivery_fee"),
    delivery_fee_source: formData.get("delivery_fee_source"),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const customerId = await upsertCustomerFromOrder(supabase, {
    workspaceId,
    name: input.customer_name,
    phone: input.customer_phone,
    wilayaCode: input.wilaya_code,
    commune: input.commune,
    address: input.address,
  });

  const { data, error } = await supabase
    .from("orders")
    .insert({
      workspace_id: workspaceId,
      source: "manual",
      product_id: input.product_id,
      variant: input.variant,
      quantity: input.quantity,
      customer_id: customerId,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      wilaya_code: input.wilaya_code,
      commune: input.commune,
      address: input.address,
      delivery_type: input.delivery_type,
      sale_price: input.sale_price,
      delivery_fee: input.delivery_fee,
      delivery_fee_source: input.delivery_fee_source,
      placed_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/app/orders/all");
  redirect(`/app/orders/${data.id}`);
}
