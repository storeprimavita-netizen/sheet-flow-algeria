import { createHmac, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { normalizeText, jsonResponse } from "@/lib/utils";
import type { Database, Enums, Json, TablesInsert } from "@/lib/supabase/database.types";

export type MappedOrder = {
  external_id: string;
  order_number?: string | null;
  quantity?: number;
  sale_price?: number | null; // per unit, DZD
  placed_at?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    city?: string | null; // commune
    address?: string | null;
  } | null;
  wilaya_name?: string | null;
  delivery_fee?: number | null; // DZD, straight from the payload
  delivery_type?: "home" | "stopdesk";
  variant?: string | null;
  product_sku?: string | null;
  product_name?: string | null;
};

const mappedOrderSchema = z.object({
  external_id: z.string().min(1),
  order_number: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  sale_price: z.number().nonnegative().nullable().optional(),
  placed_at: z.string().nullable().optional(),
  customer: z
    .object({
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  wilaya_name: z.string().nullable().optional(),
  delivery_fee: z.number().nonnegative().nullable().optional(),
  delivery_type: z.enum(["home", "stopdesk"]).optional(),
  variant: z.string().nullable().optional(),
  product_sku: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
});

// Only source webhooks (order-creation) run through this pipeline — a
// narrower type than the full integration_provider enum (which now also
// includes zrexpress, a push-out integration with its own webhook handler
// in zrexpress-webhook.ts, never an order source).
export type ProviderConfig = {
  provider: Exclude<Enums<"order_source">, "manual">;
  signatureHeader: string;
  encoding: "hex" | "base64";
  map: (payload: unknown) => MappedOrder;
};

/** Constant-time HMAC-SHA256 comparison. */
export function verifySignature(
  secret: string,
  body: string,
  signature: string,
  encoding: "hex" | "base64",
): boolean {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest(encoding);
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The one active `integration_configs` row for a provider. ponytail:
 * single-workspace lookup — per-domain multi-tenant routing becomes matching
 * `config.store_domain` against the payload here later, callers don't change.
 */
async function resolveWorkspace(
  supabase: SupabaseClient<Database>,
  provider: Enums<"integration_provider">,
): Promise<{ workspaceId: string; secret: string } | null> {
  const { data } = await supabase
    .from("integration_configs")
    .select("workspace_id, secret")
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data?.secret) return null;
  return { workspaceId: data.workspace_id, secret: data.secret };
}

/** Exact match on the 58-row national reference, substring fallback, else null. */
async function matchWilayaCode(
  supabase: SupabaseClient<Database>,
  name: string | null | undefined,
): Promise<number | null> {
  if (!name) return null;
  const target = normalizeText(name);
  const { data } = await supabase.from("wilayas").select("code, name");
  const rows = data ?? [];
  const exact = rows.find((w) => normalizeText(w.name) === target);
  if (exact) return exact.code;
  const fuzzy = rows.find(
    (w) => target.includes(normalizeText(w.name)) || normalizeText(w.name).includes(target),
  );
  return fuzzy?.code ?? null;
}

/**
 * Match a webhook line item to a product: exact SKU match first (most
 * reliable — set once in Products and mirrored in the store), else
 * exact/substring match on name, else null (an admin can fix it up later;
 * unmatched product_id is what silently disabled duplicate detection, stock
 * effects, and per-product stats for every webhook order until this — see
 * Phase 10's PROGRESS.md entry).
 */
async function matchProduct(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  sku: string | null | undefined,
  name: string | null | undefined,
): Promise<string | null> {
  if (!sku && !name) return null;
  const { data } = await supabase.from("products").select("id, sku, name").eq("workspace_id", workspaceId);
  const rows = data ?? [];
  if (sku) {
    const bySku = rows.find((p) => p.sku && p.sku.toLowerCase() === sku.toLowerCase());
    if (bySku) return bySku.id;
  }
  if (name) {
    const target = normalizeText(name);
    const exact = rows.find((p) => normalizeText(p.name) === target);
    if (exact) return exact.id;
    const fuzzy = rows.find(
      (p) => target.includes(normalizeText(p.name)) || normalizeText(p.name).includes(target),
    );
    if (fuzzy) return fuzzy.id;
  }
  return null;
}

/**
 * Map → validate → idempotently upsert the order (unique on workspace/source/
 * external_id; redeliveries only touch logistics fields, never the
 * confirmation/delivery workflow state agents own) → upsert the customer →
 * mark the event processed. Shared by the live webhook path and admin replay
 * so both take the exact same order-writing logic.
 */
async function applyMappedOrder(
  supabase: SupabaseClient<Database>,
  config: ProviderConfig,
  workspaceId: string,
  eventId: string,
  rawPayload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const fail = async (error: string) => {
    await supabase
      .from("webhook_events")
      .update({ error, processed_at: new Date().toISOString() })
      .eq("id", eventId);
    return { ok: false, error };
  };

  let mapped: MappedOrder;
  try {
    mapped = config.map(rawPayload);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "mapping threw");
  }

  const parsed = mappedOrderSchema.safeParse(mapped);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const m = parsed.data;
  const c = m.customer;

  const wilayaCode = await matchWilayaCode(supabase, m.wilaya_name);
  const productId = await matchProduct(supabase, workspaceId, m.product_sku, m.product_name);
  const deliveryType = m.delivery_type ?? "home";

  let deliveryFee = m.delivery_fee ?? null;
  let deliveryFeeSource: Enums<"delivery_fee_source"> = "manual";
  if (deliveryFee !== null && deliveryFee > 0) {
    deliveryFeeSource = "payload";
  } else if (wilayaCode !== null) {
    const { data: fee } = await supabase
      .from("wilaya_fees")
      .select("home_fee, stopdesk_fee")
      .eq("workspace_id", workspaceId)
      .eq("wilaya_code", wilayaCode)
      .maybeSingle();
    if (fee) {
      deliveryFee = deliveryType === "stopdesk" ? fee.stopdesk_fee : fee.home_fee;
      deliveryFeeSource = "wilaya_table";
    }
  }

  let customerId: string | null = null;
  if (c?.phone) {
    customerId = await upsertCustomerFromOrder(supabase, {
      workspaceId,
      name: c.name || c.phone,
      phone: c.phone,
      wilayaCode,
      commune: c.city ?? null,
      address: c.address ?? null,
    });
  }

  const logistics = {
    order_number: m.order_number ?? null,
    webhook_event_id: eventId,
    customer_id: customerId,
    customer_name: c?.name ?? null,
    customer_phone: c?.phone ?? null,
    wilaya_code: wilayaCode,
    product_id: productId,
    commune: c?.city ?? null,
    address: c?.address ?? null,
    delivery_type: deliveryType,
    quantity: m.quantity || 1,
    sale_price: m.sale_price ?? null,
    delivery_fee: deliveryFee,
    delivery_fee_source: deliveryFeeSource,
    variant: m.variant ?? null,
  };

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("source", config.provider)
    .eq("external_id", m.external_id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("orders").update(logistics).eq("id", existing.id)
    : await supabase.from("orders").insert({
        workspace_id: workspaceId,
        source: config.provider,
        external_id: m.external_id,
        placed_at: m.placed_at ?? new Date().toISOString(),
        ...logistics,
      } satisfies TablesInsert<"orders">);
  if (error) return fail(error.message);

  await Promise.all([
    supabase
      .from("webhook_events")
      .update({ external_id: m.external_id, processed_at: new Date().toISOString(), error: null })
      .eq("id", eventId),
    supabase
      .from("integration_configs")
      .update({ last_event_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("provider", config.provider),
  ]);

  return { ok: true };
}

/**
 * Verify the provider's HMAC signature, then always store the raw event —
 * bad signature, bad JSON, and mapping failures all get a row (that's the
 * audit trail and the replay source) — before mapping/upserting the order.
 * No user session → runs entirely through the service-role client.
 */
export async function processWebhook(config: ProviderConfig, req: Request): Promise<Response> {
  const body = await req.text();
  const signature = req.headers.get(config.signatureHeader) ?? "";
  const supabase = await createAdminClient();

  const integration = await resolveWorkspace(supabase, config.provider);
  const signatureOk =
    !!integration && !!signature && verifySignature(integration.secret, body, signature, config.encoding);

  let payload: unknown = {};
  let parseError: string | null = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = { _unparsable: body.slice(0, 5000) };
    parseError = "invalid json";
  }

  const { data: event, error: eventError } = await supabase
    .from("webhook_events")
    .insert({
      workspace_id: integration?.workspaceId ?? null,
      provider: config.provider,
      signature_ok: signatureOk,
      payload: payload as Json,
      error: !integration ? "integration not configured" : !signatureOk ? "invalid signature" : parseError,
    })
    .select("id")
    .single();
  if (eventError || !event) return jsonResponse({ error: eventError?.message ?? "failed to store event" }, 500);

  if (!integration) return jsonResponse({ error: "secret not configured" }, 401);
  if (!signatureOk) return jsonResponse({ error: "invalid signature" }, 401);
  if (parseError) return jsonResponse({ error: parseError }, 400);

  const result = await applyMappedOrder(supabase, config, integration.workspaceId, event.id, payload);
  return jsonResponse({ ok: result.ok, error: result.error }, 200);
}

/** Re-run mapping/upsert for one stored event — the Settings → Integrations replay button. */
export async function replayEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient();
  const { data: event } = await supabase
    .from("webhook_events")
    .select("id, provider, workspace_id, payload")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { ok: false, error: "event not found" };
  if (!event.workspace_id) return { ok: false, error: "event has no resolved workspace" };
  const config = event.provider === "shopify" ? shopifyProvider : lightfunnelProvider;
  return applyMappedOrder(supabase, config, event.workspace_id, event.id, event.payload);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const joinAddr = (parts: any[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(", ") || null;
const deliveryTypeOf = (v: any): "home" | "stopdesk" => (String(v ?? "").toLowerCase() === "stopdesk" ? "stopdesk" : "home");

export const lightfunnelProvider: ProviderConfig = {
  provider: "lightfunnels",
  signatureHeader: "x-lightfunnel-signature",
  encoding: "hex",
  map: (raw) => {
    const p = (raw ?? {}) as any;
    const customer = p?.customer ?? {};
    const ship = p?.shipping_address ?? {};
    const items: any[] = Array.isArray(p?.line_items) ? p.line_items : [];
    const qty = items.reduce((s, i) => s + num(i?.quantity), 0) || 1;
    const total = num(p?.total ?? p?.total_price);
    return {
      external_id: String(p?.id ?? p?.order_id ?? ""),
      order_number: p?.order_number ? String(p.order_number) : null,
      quantity: qty,
      sale_price: total && qty ? total / qty : null,
      placed_at: p?.created_at ?? p?.placed_at ?? null,
      customer: {
        name: customer?.full_name ?? customer?.name ?? null,
        phone: customer?.phone ?? ship?.phone ?? null,
        city: ship?.city ?? null,
        address: joinAddr([ship?.address1, ship?.address2, ship?.city, ship?.zip]),
      },
      wilaya_name: ship?.province ?? ship?.state ?? null,
      delivery_fee: p?.shipping_fee != null ? num(p.shipping_fee) : null,
      delivery_type: deliveryTypeOf(p?.delivery_type),
      variant: items[0]?.variant_title ?? items[0]?.variant ?? null,
      product_sku: items[0]?.sku ?? null,
      product_name: items[0]?.product_title ?? items[0]?.title ?? items[0]?.name ?? null,
    };
  },
};

export const shopifyProvider: ProviderConfig = {
  provider: "shopify",
  signatureHeader: "x-shopify-hmac-sha256",
  encoding: "base64",
  map: (raw) => {
    const p = (raw ?? {}) as any;
    const cust = p?.customer ?? {};
    const ship = p?.shipping_address ?? p?.default_address ?? {};
    const items: any[] = Array.isArray(p?.line_items) ? p.line_items : [];
    const qty = items.reduce((s, i) => s + num(i?.quantity), 0) || 1;
    const total = num(p?.total_price);
    const shipLine = Array.isArray(p?.shipping_lines) ? p.shipping_lines[0] : null;
    return {
      external_id: String(p?.id ?? ""),
      order_number: p?.order_number ? String(p.order_number) : p?.name ?? null,
      quantity: qty,
      sale_price: total && qty ? total / qty : null,
      placed_at: p?.created_at ?? null,
      customer: {
        name: joinAddr([cust?.first_name, cust?.last_name]) ?? cust?.name ?? null,
        phone: cust?.phone ?? ship?.phone ?? null,
        city: ship?.city ?? null,
        address: joinAddr([ship?.address1, ship?.address2, ship?.city, ship?.zip]),
      },
      wilaya_name: ship?.province ?? null,
      delivery_fee: shipLine?.price != null ? num(shipLine.price) : null,
      delivery_type: deliveryTypeOf(shipLine?.code),
      variant: items[0]?.variant_title ?? null,
      product_sku: items[0]?.sku ?? null,
      product_name: items[0]?.title ?? null,
    };
  },
};
