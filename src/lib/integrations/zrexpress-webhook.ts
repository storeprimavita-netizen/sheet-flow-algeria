/**
 * Inbound ZR Express status webhook. ZR signs with Svix (svix-id/
 * svix-timestamp/svix-signature headers), not the single-header HMAC scheme
 * `src/lib/webhook.ts` uses for the order-source webhooks — different enough
 * to warrant its own small verifier rather than bending that one to fit.
 *
 * We only ever update `zr_shipments.state` here — never `orders.delivery_status`.
 * ZR's states are a tenant-configurable workflow (see the Workflow endpoint in
 * their docs), not a fixed enum we can safely map onto our own delivery_status
 * without a per-tenant mapping UI that doesn't exist yet. An admin reads the
 * ZR state next to our own status and updates ours by hand for now.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { jsonResponse } from "@/lib/utils";
import { MAX_WEBHOOK_BYTES } from "@/lib/webhook";
import type { Json } from "@/lib/supabase/database.types";

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

type ParcelStateUpdatedPayload = {
  type?: string;
  data?: { id?: string; state?: { name?: string } | null };
};

export async function processZRWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  if (body.length > MAX_WEBHOOK_BYTES) return jsonResponse({ error: "payload too large" }, 413);
  const headers: SvixHeaders = {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  };

  const supabase = await createAdminClient();
  const { data: integration } = await supabase
    .from("integration_configs")
    .select("workspace_id, secret")
    .eq("provider", "zrexpress")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const signatureOk = !!integration?.secret && verifyZRWebhookSignature(integration.secret, body, headers);

  let payload: ParcelStateUpdatedPayload = {};
  let parseError: string | null = null;
  try {
    payload = JSON.parse(body) as ParcelStateUpdatedPayload;
  } catch {
    parseError = "invalid json";
  }

  await supabase.from("webhook_events").insert({
    workspace_id: integration?.workspace_id ?? null,
    provider: "zrexpress",
    signature_ok: signatureOk,
    payload: (!signatureOk ? { _rejected: true, bytes: body.length } : parseError ? { _unparsable: body.slice(0, 5000) } : payload) as NonNullable<Json>,
    error: !integration ? "integration not configured" : !signatureOk ? "invalid signature" : parseError,
    processed_at: new Date().toISOString(),
  });

  if (!integration) return jsonResponse({ error: "integration not configured" }, 401);
  if (!signatureOk) return jsonResponse({ error: "invalid signature" }, 401);
  if (parseError) return jsonResponse({ error: parseError }, 400);

  const parcelId = payload.data?.id;
  const stateName = payload.data?.state?.name;
  if (payload.type === "parcel.state.updated" && parcelId) {
    await supabase
      .from("zr_shipments")
      .update({ state: stateName ?? null, state_updated_at: new Date().toISOString() })
      .eq("workspace_id", integration.workspace_id)
      .eq("parcel_id", parcelId);
  }
  await supabase
    .from("integration_configs")
    .update({ last_event_at: new Date().toISOString() })
    .eq("workspace_id", integration.workspace_id)
    .eq("provider", "zrexpress");

  return jsonResponse({ ok: true }, 200);
}
