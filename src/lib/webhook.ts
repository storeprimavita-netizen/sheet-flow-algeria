import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

export type MappedOrder = {
  external_id: string;
  order_number?: string | null;
  quantity?: number;
  unit_price?: number | null;
  placed_at?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
};

export type ProviderConfig = {
  source: string;
  secretSettingKey: string;
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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Verify the provider's HMAC signature, then idempotently upsert the order
 * (keyed on `source, external_id`). Re-deliveries never clobber agent-set
 * confirmation/delivery status — only webhook-owned logistics fields update.
 * No user session → runs entirely through the service-role client.
 */
export async function processWebhook(
  config: ProviderConfig,
  req: Request,
): Promise<Response> {
  const body = await req.text();
  const signature = req.headers.get(config.signatureHeader) ?? "";

  const secret = await getSetting(config.secretSettingKey);
  if (!secret) return json({ error: "secret not configured" }, 401);
  if (!signature || !verifySignature(secret, body, signature, config.encoding)) {
    return json({ error: "invalid signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const mapped = config.map(payload);
  if (!mapped.external_id) return json({ error: "missing external id" }, 400);

  const supabase = await createAdminClient();

  // Find or create the customer contact (by phone, type=customer).
  let customerId: string | null = null;
  const c = mapped.customer;
  if (c?.phone) {
    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .upsert(
        {
          name: c.name || c.phone,
          phone: c.phone,
          type: "customer",
          city: c.city ?? null,
          location: c.address ?? null,
        },
        { onConflict: "phone" },
      )
      .select("id")
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    customerId = contact?.id ?? null;
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("source", config.source)
    .eq("external_id", mapped.external_id)
    .maybeSingle();

  if (existing) {
    // Update only webhook-owned fields; never reset agent workflow state.
    const { error } = await supabase
      .from("orders")
      .update({
        order_number: mapped.order_number ?? null,
        customer_id: customerId,
        quantity: mapped.quantity || 1,
        unit_price: mapped.unit_price ?? null,
        city: c?.city ?? null,
        address: c?.address ?? null,
        placed_at: mapped.placed_at ?? null,
        raw_payload: payload as TablesInsert<"orders">["raw_payload"],
      })
      .eq("id", existing.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, action: "updated" }, 200);
  }

  const insert: TablesInsert<"orders"> = {
    source: config.source,
    external_id: mapped.external_id,
    order_number: mapped.order_number ?? null,
    customer_id: customerId,
    quantity: mapped.quantity || 1,
    unit_price: mapped.unit_price ?? null,
    city: c?.city ?? null,
    address: c?.address ?? null,
    placed_at: mapped.placed_at ?? new Date().toISOString(),
    raw_payload: payload as TablesInsert<"orders">["raw_payload"],
    confirmation_status: "wait_for_confirmation",
    delivery_status: "wait_for_deposit",
  };
  const { error } = await supabase.from("orders").insert(insert);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, action: "created" }, 200);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const joinAddr = (parts: any[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(", ") || null;

export const lightfunnelProvider: ProviderConfig = {
  source: "lightfunnel",
  secretSettingKey: SETTING_KEYS.lightfunnelSecret,
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
      unit_price: total && qty ? total / qty : null,
      placed_at: p?.created_at ?? p?.placed_at ?? null,
      customer: {
        name: customer?.full_name ?? customer?.name ?? null,
        phone: customer?.phone ?? ship?.phone ?? null,
        city: ship?.city ?? null,
        address: joinAddr([ship?.address1, ship?.address2, ship?.city, ship?.zip]),
      },
    };
  },
};

export const shopifyProvider: ProviderConfig = {
  source: "shopify",
  secretSettingKey: SETTING_KEYS.shopifySecret,
  signatureHeader: "x-shopify-hmac-sha256",
  encoding: "base64",
  map: (raw) => {
    const p = (raw ?? {}) as any;
    const cust = p?.customer ?? {};
    const ship = p?.shipping_address ?? p?.default_address ?? {};
    const items: any[] = Array.isArray(p?.line_items) ? p.line_items : [];
    const qty = items.reduce((s, i) => s + num(i?.quantity), 0) || 1;
    const total = num(p?.total_price);
    return {
      external_id: String(p?.id ?? ""),
      order_number: p?.order_number ? String(p.order_number) : p?.name ?? null,
      quantity: qty,
      unit_price: total && qty ? total / qty : null,
      placed_at: p?.created_at ?? null,
      customer: {
        name: joinAddr([cust?.first_name, cust?.last_name]) ?? cust?.name ?? null,
        phone: cust?.phone ?? ship?.phone ?? null,
        city: ship?.city ?? null,
        address: joinAddr([ship?.address1, ship?.address2, ship?.city, ship?.zip]),
      },
    };
  },
};
