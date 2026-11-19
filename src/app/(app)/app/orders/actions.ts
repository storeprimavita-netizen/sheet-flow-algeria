"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { getProfile, isCurrentUserAdmin, requireAdminProfile as adminProfile } from "@/lib/rbac";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { markStorePublicStale } from "@/lib/store/invalidate";
import { getZRCredentials, getZRParcel, zrErrorMessage } from "@/lib/integrations/zrexpress";
import { applyZRParcelState } from "@/lib/integrations/zrexpress-webhook";
import { hubsForOrder, pushToZR } from "@/lib/integrations/zrexpress-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTINGS_SCHEMAS } from "@/lib/settings";
import { newOrderBlock } from "@/lib/pricing-delivery";
import {
  CONFIRMATION_STATUSES,
  MANUAL_DELIVERY_STATUSES,
  DELIVERY_TYPES,
  DELIVERY_FEE_SOURCES,
} from "@/lib/enums";

export type UpdateResult = { ok: true; warning?: string } | { ok: false; error: string };

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

  const { data: changed, error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_confirmation_status: stage === "confirmation" && status !== "" ? (status as Enums<"confirmation_status">) : undefined,
    p_delivery_status: stage === "delivery" && status !== "" ? (status as Enums<"delivery_status">) : undefined,
    p_confirmation_comment: stage === "confirmation" ? comment || undefined : undefined,
  });
  if (error) return { ok: false, error: error.message };
  markStorePublicStale(); // order status moves stock, which the public page shows

  // ⚡ Auto-push to ZR on confirm (Settings → ZR Express, default off). Runs
  // with the service role: the confirming agent can't read the ZR API key
  // (admin-only RLS) — the confirmation itself already passed the RPC's
  // authorization above. A push failure never undoes the confirmation; it
  // comes back as a warning and the admin can push from the order page.
  // Only when THIS call flipped the order to confirmed: the RPC row-locks, so
  // a double-submit can't push two parcels (OWASP 2nd pass, CWE-367).
  if (changed && stage === "confirmation" && status === "confirmed") {
    // settings is admin-only (RLS): an agent's session would always read the
    // default (off), so the flag is read with the same service-role client.
    const profile = await getProfile();
    const admin = await createAdminClient();
    const { data: flag } = profile?.workspaceId
      ? await admin.from("settings").select("value").eq("workspace_id", profile.workspaceId).eq("key", "zr_auto_push").maybeSingle()
      : { data: null };
    if (profile?.workspaceId && SETTINGS_SCHEMAS.zr_auto_push.safeParse(flag?.value).data?.enabled) {
      const pushed = await pushToZR(admin, profile.workspaceId, orderId);
      if (!pushed.ok && !pushed.error.includes("already sent")) {
        revalidatePath(`/app/orders/${orderId}`);
        return { ok: true, warning: `ZR Express: ${pushed.error}` };
      }
    }
  }

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
export async function pushOrderToZRExpress(orderId: string, hubId?: string | null): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const res = await pushToZR(await createClient(), workspaceId, orderId, hubId);
  if (res.ok) revalidatePath(`/app/orders/${orderId}`);
  return res;
}

/**
 * Admin override for an order stuck on a delivery type its wilaya no longer ships:
 * switch it to home and re-seed the fee from the single fee source (D14).
 */
export async function switchOrderToHome(orderId: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const id = z.string().uuid().parse(orderId);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("wilaya_code, delivery_type")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!order?.wilaya_code) return { ok: false, error: "Order needs a wilaya first." };
  const { data: sent } = await supabase.from("zr_shipments").select("order_id").eq("order_id", id).maybeSingle();
  if (sent) return { ok: false, error: "This order was already sent to ZR Express." };
  const { data: fee } = await supabase.rpc("delivery_fee_for", { p_ws: workspaceId, p_wilaya: order.wilaya_code, p_type: "home" });
  if (fee === null || fee === undefined) return { ok: false, error: "Home delivery is not available in this wilaya." };
  const { error } = await supabase
    .from("orders")
    .update({ delivery_type: "home", delivery_fee: Number(fee), delivery_fee_source: "wilaya_table" })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/orders/${id}`);
  return { ok: true };
}

/** Bulk "Send to ZR" from the delivery queue. Sequential (ZR rate limits) —
 * ponytail: switch to ZR's bulk endpoint (100/request) if volumes grow. */
export async function pushOrdersToZRExpress(
  orderIds: string[],
): Promise<{ ok: true; sent: number; failed: { id: string; error: string }[] }> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const failed: { id: string; error: string }[] = [];
  for (const id of z.array(z.string().uuid()).max(200).parse(orderIds)) {
    const res = await pushToZR(supabase, workspaceId, id);
    if (!res.ok) failed.push({ id, error: res.error });
  }
  revalidatePath("/app/orders/delivery");
  return { ok: true, sent: orderIds.length - failed.length, failed };
}

export async function listZRHubs(orderId: string) {
  const { workspaceId } = await adminProfile();
  return hubsForOrder(await createClient(), workspaceId, orderId);
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

  try {
    await applyZRParcelState(await createAdminClient(), workspaceId, {
      id: shipment.parcel_id,
      live: true,
      state: detail.state,
      situation: detail.situation?.slug ?? detail.situation?.name,
      isReturn: detail.isReturn,
      stateAt: detail.lastStateUpdateAt ? new Date(detail.lastStateUpdateAt).toISOString() : undefined,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to apply ZR state." };
  }
  const { error } = await supabase
    .from("zr_shipments")
    .update({ tracking_number: detail.trackingNumber, last_synced_at: new Date().toISOString() })
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };

  markStorePublicStale();
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
  markStorePublicStale();
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
      : z.enum(MANUAL_DELIVERY_STATUSES).parse(status);

  const supabase = await createClient();
  for (const id of parsedIds) {
    const { error } = await supabase.rpc("transition_order_status", { p_order_id: id, [key]: value });
    if (error) return { ok: false, error: error.message };
  }
  markStorePublicStale();
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
const deliverySchema = z.object({ status: z.enum(MANUAL_DELIVERY_STATUSES) });

export async function updateDeliveryStatus(orderId: string, formData: FormData) {
  const input = deliverySchema.parse({ status: formData.get("status") });
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_delivery_status: input.status,
  });
  if (error) throw new Error(error.message);
  markStorePublicStale();
  revalidatePath("/app/orders/delivery");
  revalidatePath(`/app/orders/${orderId}`);
}

// ---------------------------------------------------------------------------
// Tags + cancellation reason (option_sets — Phase 12 §9). Any authenticated
// role may set these on an order they can already see — RLS on `orders`/
// `order_tags` is the real gate, not a role check here.
// ---------------------------------------------------------------------------
export async function setOrderTags(orderId: string, optionIds: string[]): Promise<UpdateResult> {
  const parsed = z.array(z.string().uuid()).safeParse(optionIds);
  if (!parsed.success) return { ok: false, error: "Invalid tags" };
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("workspace_id").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, error: "Not found" };

  const { error: delError } = await supabase.from("order_tags").delete().eq("order_id", orderId);
  if (delError) return { ok: false, error: delError.message };
  if (parsed.data.length) {
    const { error: insError } = await supabase
      .from("order_tags")
      .insert(parsed.data.map((option_id) => ({ order_id: orderId, option_id, workspace_id: order.workspace_id })));
    if (insError) return { ok: false, error: insError.message };
  }
  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app/orders/all");
  return { ok: true };
}

export async function setOrderCancellationReason(orderId: string, optionId: string | null): Promise<UpdateResult> {
  const parsed = z.string().uuid().nullable().safeParse(optionId);
  if (!parsed.success) return { ok: false, error: "Invalid reason" };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ cancellation_reason_option_id: parsed.data }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual order creation (admin) — customer snapshot upserts `customers`.
// ---------------------------------------------------------------------------
const createOrderSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.preprocess((v) => (typeof v === "string" && v.trim() && v !== "__none" ? v.trim() : null), z.string().uuid().nullable()),
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

/** Form-level failure: `error` is an i18n key suffix under orders.form (never raw server text). */
export type OrderFormState = { error: string } | undefined;

export async function createOrder(formData: FormData): Promise<OrderFormState> {
  const { workspaceId } = await adminProfile();
  const input = createOrderSchema.parse({
    product_id: formData.get("product_id"),
    variant_id: formData.get("variant_id"),
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
  const { data: feeRow } = await supabase
    .from("wilaya_fees")
    .select("home_fee, stopdesk_fee, priced, stopdesk_available, stop_shipping")
    .eq("workspace_id", workspaceId)
    .eq("wilaya_code", input.wilaya_code)
    .maybeSingle();
  const block = newOrderBlock(feeRow, input.delivery_type);
  if (block) return { error: `blocked.${block}` };

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
      variant_id: input.variant_id, // the label snapshot is written by a trigger
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
  if (error) return { error: "createFailed" };

  markStorePublicStale();
  revalidatePath("/app/orders/all");
  redirect(`/app/orders/${data.id}`);
}

// ---------------------------------------------------------------------------
// Change (or assign) the size of an order — admin only. The database moves the stock hold
// from the old variant to the new one in one logged step and rewrites the label (D54.6).
// ---------------------------------------------------------------------------
const changeOrderVariantSchema = z.object({ orderId: z.string().uuid(), variantId: z.string().uuid() });

export async function changeOrderVariant(orderId: string, variantId: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = changeOrderVariantSchema.safeParse({ orderId, variantId });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ variant_id: parsed.data.variantId })
    .eq("id", parsed.data.orderId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "order not found" };
  revalidatePath(`/app/orders/${parsed.data.orderId}`);
  revalidatePath("/app/orders");
  markStorePublicStale();
  revalidatePath("/app/stock");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Swap: admin creates a new order for customer B from a returning/returned
// order A (same product/qty, item never re-enters warehouse). One RPC transaction.
// ---------------------------------------------------------------------------
const swapOrderSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().min(1),
  wilaya_code: z.coerce.number().int(),
  commune: optionalText,
  address: optionalText,
});

export async function swapOrder(orderId: string, formData: FormData): Promise<{ error: string } | undefined> {
  const { workspaceId } = await adminProfile();
  const id = z.string().uuid().parse(orderId);
  const input = swapOrderSchema.parse({
    customer_name: formData.get("customer_name"),
    customer_phone: formData.get("customer_phone"),
    wilaya_code: formData.get("wilaya_code"),
    commune: formData.get("commune"),
    address: formData.get("address"),
  });

  const supabase = await createClient();

  // One transaction (D30): new order B + A to 'swap' + link, or nothing.
  const { data: newOrderId, error: swapErr } = await supabase.rpc("swap_order", {
    p_order_id: id,
    p_customer_id: null as unknown as string,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_wilaya_code: input.wilaya_code,
    p_commune: input.commune ?? "",
    p_address: input.address ?? "",
  });
  if (swapErr || !newOrderId) {
    // the RPC refuses a delivery type the destination wilaya cannot ship; anything else is a generic failure
    return { error: /not available/.test(swapErr?.message ?? "") ? "form.blocked.type_unavailable" : "swap.failed" };
  }

  // only after the swap succeeded: link the customer record to the new order
  const customerId = await upsertCustomerFromOrder(supabase, {
    workspaceId,
    name: input.customer_name,
    phone: input.customer_phone,
    wilayaCode: input.wilaya_code,
    commune: input.commune,
    address: input.address,
  });
  if (customerId) {
    // a double submit returns the existing replacement: never re-point a customer already set
    const { error: custErr } = await supabase
      .from("orders")
      .update({ customer_id: customerId })
      .eq("id", newOrderId)
      .is("customer_id", null);
    if (custErr) throw new Error(custErr.message);
  }

  markStorePublicStale();
  revalidatePath("/app/orders");
  redirect(`/app/orders/${newOrderId}`);
}
