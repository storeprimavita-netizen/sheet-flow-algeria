import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { deliveryFeeFor } from "@/lib/pricing-delivery";
import { normalizeText } from "@/lib/utils";
import {
  getZRCredentials,
  createZRParcel,
  getZRParcel,
  findZRParcelByExternalId,
  searchZRHubs,
  toInternationalDzPhone,
  zrErrorMessage,
  type ZRHub,
} from "@/lib/integrations/zrexpress";

export type PushResult = { ok: true } | { ok: false; error: string };

/**
 * Push one confirmed order to ZR Express as a parcel. Client-agnostic so the
 * same code serves the admin button / bulk push (RLS-scoped session client)
 * and auto-push-on-confirm (service role — the confirming agent can't read
 * the ZR API key, by design). Stop-desk orders need a hub: `hubId` if given,
 * else the wilaya's only hub, else an error asking to pick one.
 */
export async function pushToZR(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  orderId: string,
  hubId?: string | null,
): Promise<PushResult> {
  const { data: order } = await supabase
    .from("orders")
    .select("*, product:products(name)")
    .eq("workspace_id", workspaceId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.confirmation_status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can be sent to ZR Express." };
  }
  if (order.swapped_to_order_id) {
    return { ok: false, error: "This order was swapped to another order and cannot be sent." };
  }
  if (!order.wilaya_code || (order.delivery_type === "home" && !order.commune)) {
    return { ok: false, error: "Order needs a wilaya (and a commune for home delivery) before it can be sent." };
  }
  if (!order.customer_phone) {
    return { ok: false, error: "Order has no customer phone." };
  }

  // Delivery guard (D27): unpriced means shipping is off. The only exception is a stop-desk order
  // that keeps its fee in a wilaya that has since become home-only (warn, still push).
  const { data: feeRow } = await supabase
    .from("wilaya_fees")
    .select("home_fee, stopdesk_fee, priced, stopdesk_available")
    .eq("workspace_id", workspaceId)
    .eq("wilaya_code", order.wilaya_code)
    .maybeSingle();
  if (feeRow) {
    if (!feeRow.priced) return { ok: false, error: "This wilaya has no delivery price, so orders cannot be sent." };
    if (deliveryFeeFor(feeRow, order.delivery_type) === null) {
      if (!(Number(order.delivery_fee) > 0)) {
        return { ok: false, error: "This delivery type is not available in this wilaya." };
      }
      console.warn(`pushToZR: order ${orderId} uses a delivery type no longer available in wilaya ${order.wilaya_code}`);
    }
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

  // Stop desk → pickup-point parcel at a hub; home → commune territory.
  let hub: string | null = null;
  if (order.delivery_type === "stopdesk") {
    if (hubId) hub = hubId;
    else {
      let hubs: ZRHub[];
      try {
        hubs = await searchZRHubs(creds, wilayaTerritory.id);
      } catch (e) {
        return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
      }
      if (hubs.length !== 1) {
        return { ok: false, error: hubs.length ? "Several stop desks in this wilaya — pick one on the order page." : "No ZR stop desk in this wilaya." };
      }
      hub = hubs[0].id;
    }
  }

  let districtId = wilayaTerritory.id;
  if (order.commune) {
    const { data: communeTerritories } = await supabase
      .from("zr_territories")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("level", "commune")
      .eq("parent_id", wilayaTerritory.id);
    const target = normalizeText(order.commune);
    const rows = communeTerritories ?? [];
    const commune =
      rows.find((c) => normalizeText(c.name) === target) ??
      rows.find((c) => target.includes(normalizeText(c.name)) || normalizeText(c.name).includes(target));
    if (commune) districtId = commune.id;
    else if (!hub) {
      return {
        ok: false,
        error: `Commune "${order.commune}" not found in ZR Express's list for this wilaya — check spelling or sync territories in Settings.`,
      };
    }
  }

  const productName = order.product?.name ?? "Item";
  // COD: the customer pays the courier sale·qty + delivery fee.
  const amount = (order.sale_price ?? 0) * order.quantity + (order.delivery_fee ?? 0);

  // Idempotency: a parcel may already exist from an earlier push whose DB insert failed.
  let parcel: { id: string };
  let created = false;
  try {
    const found = await findZRParcelByExternalId(creds, order.id);
    created = !found;
    parcel =
      found ??
      (await createZRParcel(creds, {
        customerName: order.customer_name ?? "—",
        phone: toInternationalDzPhone(order.customer_phone),
        cityTerritoryId: wilayaTerritory.id,
        districtTerritoryId: districtId,
        street: order.address,
        productName,
        quantity: order.quantity,
        unitPrice: order.sale_price ?? 0,
        description: `${order.quantity}x ${productName}`.slice(0, 250),
        amount,
        externalId: order.id,
        hubId: hub,
      }));
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
  }

  // Best-effort follow-up read for the tracking number — the create response
  // only returns the parcel id; "Refresh status" picks it up later otherwise.
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
  if (!error) return { ok: true };
  if (error.code === "23505") {
    // lost a race: if WE just created a parcel it is now a second real parcel nobody links to
    if (created) console.error("zr duplicate parcel after racing push — cancel in ZR dashboard:", parcel.id, "order", order.id);
    return { ok: false, error: "This order was already sent to ZR Express." };
  }
  console.error("zr_shipments insert failed after parcel creation", parcel.id, error.message);
  return {
    ok: false,
    error: `Parcel ${parcel.id} exists at ZR Express but saving failed (${error.message}). Retry to link it.`,
  };
}

/** Stop desks in an order's wilaya — for the hub picker on the order page. */
export async function hubsForOrder(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  orderId: string,
): Promise<{ ok: true; hubs: ZRHub[] } | { ok: false; error: string }> {
  const { data: order } = await supabase.from("orders").select("wilaya_code").eq("id", orderId).maybeSingle();
  if (!order?.wilaya_code) return { ok: false, error: "Order has no wilaya." };
  const { data: wilaya } = await supabase
    .from("zr_territories")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("level", "wilaya")
    .eq("code", order.wilaya_code)
    .maybeSingle();
  if (!wilaya) return { ok: false, error: "Sync ZR territories in Settings first." };
  try {
    const creds = await getZRCredentials(supabase, workspaceId);
    return { ok: true, hubs: await searchZRHubs(creds, wilaya.id) };
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
  }
}
