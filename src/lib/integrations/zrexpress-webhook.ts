/**
 * Inbound ZR Express status webhook. ZR signs with Svix (svix-id/
 * svix-timestamp/svix-signature headers), not the single-header HMAC scheme
 * `src/lib/webhook.ts` uses for the order-source webhooks — different enough
 * to warrant its own small verifier rather than bending that one to fit.
 *
 * Tenant-safe: each ZR tenant registers its own endpoint with its own Svix
 * secret, so the workspace is whichever active config's secret verifies the
 * event (no shared "first config" guess). Deduped on svix-id (Svix retries).
 * `zr_shipments.state` always mirrors ZR; `orders.delivery_status` follows
 * only through the workspace's own `zr_state_map` setting (ZR states are a
 * per-tenant workflow) — the update goes through `orders`, so the status
 * triggers still write history + stock exactly as a UI change would.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { jsonResponse } from "@/lib/utils";
import { MAX_WEBHOOK_BYTES } from "@/lib/webhook";
import type { Json } from "@/lib/supabase/database.types";
import { SETTINGS_SCHEMAS, zrStateKey } from "@/lib/settings";

const TOLERANCE_SECONDS = 300; // reject events signed more than 5 minutes off

export type SvixHeaders = { id: string; timestamp: string; signature: string };

export function verifyZRWebhookSignature(secret: string, body: string, headers: SvixHeaders): boolean {
  const tsNum = Number(headers.timestamp);
  if (!headers.id || !Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", secretBytes)
    .update(`${headers.id}.${headers.timestamp}.${body}`, "utf8")
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  // svix-signature can carry multiple "v1,<sig>" entries (key rotation) — any match is valid.
  return headers.signature
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => {
      const buf = Buffer.from(sig, "base64");
      return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
    });
}

// zod at the trust boundary (CLAUDE.md): only the fields we act on, bounded.
const payloadSchema = z
  .object({
    type: z.string().max(100).optional(),
    data: z
      .object({
        id: z.string().uuid().optional(),
        state: z.object({ name: z.string().trim().min(1).max(100).optional() }).nullish(),
      })
      .optional(),
  })
  .passthrough();
type ParcelStateUpdatedPayload = z.infer<typeof payloadSchema>;

export async function processZRWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  if (body.length > MAX_WEBHOOK_BYTES) return jsonResponse({ error: "payload too large" }, 413);
  const headers: SvixHeaders = {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  };

  const supabase = await createAdminClient();
  const { data: configs } = await supabase
    .from("integration_configs")
    .select("workspace_id, secret")
    .eq("provider", "zrexpress")
    .eq("is_active", true);
  // ponytail: O(workspaces) HMACs per event — fine until thousands of tenants; then key by URL token.
  const integration = (configs ?? []).find((c) => c.secret && verifyZRWebhookSignature(c.secret, body, headers)) ?? null;
  const signatureOk = !!integration;

  if (integration) {
    const { data: seen } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("provider", "zrexpress")
      .eq("workspace_id", integration.workspace_id)
      .eq("external_id", headers.id)
      .limit(1)
      .maybeSingle();
    if (seen) return jsonResponse({ ok: true, duplicate: true }, 200);
  }

  let payload: ParcelStateUpdatedPayload = {};
  let parseError: string | null = null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(body));
    if (parsed.success) payload = parsed.data;
    else parseError = "unexpected payload shape";
  } catch {
    parseError = "invalid json";
  }

  await supabase.from("webhook_events").insert({
    workspace_id: integration?.workspace_id ?? null,
    provider: "zrexpress",
    external_id: signatureOk ? headers.id : null,
    signature_ok: signatureOk,
    payload: (!signatureOk ? { _rejected: true, bytes: body.length } : parseError ? { _unparsable: body.slice(0, 5000) } : payload) as NonNullable<Json>,
    error: !configs?.length ? "integration not configured" : !signatureOk ? "invalid signature" : parseError,
    processed_at: new Date().toISOString(),
  });

  if (!configs?.length) return jsonResponse({ error: "integration not configured" }, 401);
  if (!integration) return jsonResponse({ error: "invalid signature" }, 401);
  if (parseError) return jsonResponse({ error: parseError }, 400);

  const ws = integration.workspace_id;
  const parcelId = payload.data?.id;
  const stateName = payload.data?.state?.name;
  if (payload.type === "parcel.state.updated" && parcelId) {
    const { data: shipment } = await supabase
      .from("zr_shipments")
      .update({ state: stateName ?? null, state_updated_at: new Date().toISOString() })
      .eq("workspace_id", ws)
      .eq("parcel_id", parcelId)
      .select("order_id")
      .maybeSingle();

    if (shipment && stateName) {
      const { data: row } = await supabase
        .from("settings")
        .select("value")
        .eq("workspace_id", ws)
        .eq("key", "zr_state_map")
        .maybeSingle();
      const parsed = SETTINGS_SCHEMAS.zr_state_map.safeParse(row?.value);
      const key = zrStateKey(stateName);
      // hasOwn: a ZR state literally named "__proto__" must not resolve to Object.prototype.
      const mapped = parsed.success && Object.hasOwn(parsed.data.map, key) ? parsed.data.map[key] : undefined;
      if (mapped) {
        await supabase
          .from("orders")
          .update({ delivery_status: mapped })
          .eq("workspace_id", ws)
          .eq("id", shipment.order_id)
          .neq("delivery_status", mapped);
      }
    }
  }
  await supabase
    .from("integration_configs")
    .update({ last_event_at: new Date().toISOString() })
    .eq("workspace_id", ws)
    .eq("provider", "zrexpress");

  return jsonResponse({ ok: true }, 200);
}
