"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { isCurrentUserAdmin, requireAdminProfile as adminProfile } from "@/lib/rbac";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { normalizeText } from "@/lib/utils";
import {
  getZRCredentials,
  createZRParcel,
  getZRParcel,
  toInternationalDzPhone,
  zrErrorMessage,
} from "@/lib/integrations/zrexpress";
import {
  CONFIRMATION_STATUSES,
  DELIVERY_STATUSES,
  DELIVERY_TYPES,
  DELIVERY_FEE_SOURCES,
} from "@/lib/enums";

export type UpdateResult = { ok: true } | { ok: false; error: string };

const optionalText = z.string().trim().optional().transform((v) => v || null);

/**
 * Stage-aware order status update, via the `transition_order_status` RPC
 * (supabase/migrations/00009_order_transitions.sql) rather than a plain
 * `.update()`. A confirmation agent setting confirmation_status='confirmed'
 * moves the row out of their own o_sel visibility bucket — Postgres requires
 * the post-UPDATE row to still satisfy the table's SELECT policy for the
 * calling role, so a direct RLS-scoped UPDATE is rejected even though the
 * UPDATE policy's WITH CHECK passes (found live in Phase 10's E2E pass; see
 * the migration's comment for the full story). The RPC re-implements the
 * authorization check itself and bypasses that requirement; the
 * guard_order_fields trigger still enforces per-role field restrictions.
 */
export async function updateOrderStatus(params: {
  orderId: string;
  stage: "confirmation" | "delivery";
  status: string;
  comment: string;
}): Promise<UpdateResult> {
  const { orderId, stage, status, comment } = params;
  const supabase = await createClient();

  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_confirmation_status: stage === "confirmation" && status !== "" ? (status as Enums<"confirmation_status">) : undefined,
    p_delivery_status: stage === "delivery" && status !== "" ? (status as Enums<"delivery_status">) : undefined,
    p_confirmation_comment: stage === "confirmation" ? comment || undefined : undefined,
  });
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
// ZR Express — push a confirmed order as a parcel, refresh its status.
// Admin-only: needs the ZR API key, which only admins can read (RLS).
// ---------------------------------------------------------------------------
export async function pushOrderToZRExpress(orderId: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, product:products(name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.confirmation_status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can be sent to ZR Express." };
  }
  if (order.delivery_type !== "home") {
    return { ok: false, error: "Only home-delivery orders can be sent to ZR Express yet — stop-desk needs a hub picker that isn't built." };
  }
  if (!order.wilaya_code || !order.commune) {
    return { ok: false, error: "Order needs a wilaya and commune before it can be sent." };
  }
  if (!order.customer_phone) {
    return { ok: false, error: "Order has no customer phone." };
  }

  const { data: existing } = await supabase
    .from("zr_shipments")
    .select("order_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { ok: false, error: "This order was already sent to ZR Express." };

  let creds;
  try {
    creds = await getZRCredentials(supabase, workspaceId);
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "ZR Express not configured.") };
  }

  const { data: wilayaTerritory } = await supabase
    .from("zr_territories")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("level", "wilaya")
    .eq("code", order.wilaya_code)
    .maybeSingle();
  if (!wilayaTerritory) {
    return { ok: false, error: "Wilaya not found in ZR Express's territory list — sync territories in Settings." };
  }

  const { data: communeTerritories } = await supabase
    .from("zr_territories")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("level", "commune")
    .eq("parent_id", wilayaTerritory.id);
  const target = normalizeText(order.commune);
  const rows = communeTerritories ?? [];
  const communeTerritory =
    rows.find((c) => normalizeText(c.name) === target) ??
    rows.find((c) => target.includes(normalizeText(c.name)) || normalizeText(c.name).includes(target));
  if (!communeTerritory) {
    return {
      ok: false,
      error: `Commune "${order.commune}" not found in ZR Express's list for this wilaya — check spelling or sync territories in Settings.`,
    };
  }

  const productName = order.product?.name ?? "Item";
  const amount = (order.sale_price ?? 0) * order.quantity + (order.delivery_fee ?? 0);

  let parcel: { id: string };
  try {
    parcel = await createZRParcel(creds, {
      customerName: order.customer_name ?? "—",
      phone: toInternationalDzPhone(order.customer_phone),
      cityTerritoryId: wilayaTerritory.id,
      districtTerritoryId: communeTerritory.id,
      street: order.address,
      productName,
      quantity: order.quantity,
      unitPrice: order.sale_price ?? 0,
      description: `${order.quantity}x ${productName}`.slice(0, 250),
      amount,
      externalId: order.id,
    });
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
  }

  // Best-effort follow-up read for the tracking number — the create response
  // only returns the parcel id. If this fails the parcel still exists on
  // ZR's side; "Refresh status" on the order picks it up later.
  let trackingNumber: string | null = null;
  let state: string | null = null;
  try {
    const detail = await getZRParcel(creds, parcel.id);
    trackingNumber = detail.trackingNumber;
    state = detail.state?.name ?? null;
  } catch {
    // swallow — see comment above
  }

  const { error } = await supabase.from("zr_shipments").insert({
    order_id: orderId,
    workspace_id: workspaceId,
    parcel_id: parcel.id,
    tracking_number: trackingNumber,
    state,
    state_updated_at: state ? new Date().toISOString() : null,
    last_synced_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/orders/${orderId}`);
  return { ok: true };
}

export async function refreshZRShipmentStatus(orderId: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();

  const { data: shipment } = await supabase
    .from("zr_shipments")
    .select("parcel_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!shipment) return { ok: false, error: "Not sent to ZR Express yet." };

  let creds;
  try {
    creds = await getZRCredentials(supabase, workspaceId);
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "ZR Express not configured.") };
  }

  let detail;
  try {
    detail = await getZRParcel(creds, shipment.parcel_id);
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
  }

  const { error } = await supabase
    .from("zr_shipments")
    .update({
      tracking_number: detail.trackingNumber,
      state: detail.state?.name ?? null,
      state_updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/orders/${orderId}`);
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
  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_confirmation_status: input.status,
    p_confirmation_comment: input.comment ?? undefined,
  });
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
// Bulk actions (All view, admin-only). Selection is capped at one page (~25),
// so a per-id loop through the same transition RPC is fine here.
// ponytail: sequential loop, not a batched RPC — switch only if bulk sets ever
// span hundreds of orders (the UI selects a single page at a time).
// ---------------------------------------------------------------------------
const uuidArray = z.array(z.string().uuid()).min(1).max(200);

export async function bulkTransition(
  ids: string[],
  stage: "confirmation" | "delivery",
  status: string,
): Promise<UpdateResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const parsedIds = uuidArray.parse(ids);
  const key = stage === "confirmation" ? "p_confirmation_status" : "p_delivery_status";
  const value =
    stage === "confirmation"
      ? z.enum(CONFIRMATION_STATUSES).parse(status)
      : z.enum(DELIVERY_STATUSES).parse(status);

  const supabase = await createClient();
  for (const id of parsedIds) {
    const { error } = await supabase.rpc("transition_order_status", { p_order_id: id, [key]: value });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/app/orders/all");
  return { ok: true };
}

export async function bulkAssignAgents(
  ids: string[],
  confirmationAgent: string | null,
  deliveryAgent: string | null,
): Promise<UpdateResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const parsedIds = uuidArray.parse(ids);
  // only send the fields the admin actually chose (empty = leave unchanged)
  const patch: { assigned_confirmation_agent?: string | null; assigned_delivery_agent?: string | null } = {};
  if (confirmationAgent !== null) patch.assigned_confirmation_agent = confirmationAgent || null;
  if (deliveryAgent !== null) patch.assigned_delivery_agent = deliveryAgent || null;
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(patch).in("id", parsedIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/orders/all");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delivery queue
// ---------------------------------------------------------------------------
const deliverySchema = z.object({ status: z.enum(DELIVERY_STATUSES) });

export async function updateDeliveryStatus(orderId: string, formData: FormData) {
  const input = deliverySchema.parse({ status: formData.get("status") });
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_delivery_status: input.status,
  });
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
