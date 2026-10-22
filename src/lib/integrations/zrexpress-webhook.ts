/**
 * Inbound ZR Express status webhook. ZR signs with Svix (svix-id/
 * svix-timestamp/svix-signature headers), not the single-header HMAC scheme
 * `src/lib/webhook.ts` uses for the order-source webhooks — different enough
 * to warrant its own small verifier rather than bending that one to fit.
 *
 * Tenant-safe: each ZR tenant registers its own endpoint with its own Svix
 * secret, so the workspace is whichever active config's secret verifies the
 * event (no shared "first config" guess). Deduped on svix-id (Svix retries).
 * `zr_shipments.state` mirrors ZR; `orders.delivery_status` follows the
 * STORED state via the workspace's `zr_state_map`, all inside the
 * `apply_zr_state` RPC (one transaction under the shipment row lock), so
 * webhook / refresh / cron can interleave and still end on the newest state.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { jsonResponse } from "@/lib/utils";
import { MAX_WEBHOOK_BYTES } from "@/lib/webhook";
import type { Json } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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
// Timestamps are ISO with offsets; invalid ones are dropped here and rejected
// later only if no usable timestamp remains.
const ts = z.string().max(40).datetime({ offset: true }).optional().catch(undefined);
const name = z.string().trim().min(1).max(100);
const payloadSchema = z
  .object({
    eventType: z.string().max(100).optional(),
    type: z.string().max(100).optional(),
    occurredAt: ts,
    data: z
      .object({
        id: z.string().uuid().optional(),
        state: z.object({ name: name.optional().catch(undefined), slug: name.nullish().catch(undefined) }).nullish().catch(undefined),
        situation: z.object({ slug: name.nullish().catch(undefined) }).nullish().catch(undefined),
        isReturn: z.boolean().nullish().catch(undefined),
        lastStateUpdateAt: ts,
      })
      .optional(),
  })
  .passthrough();
type ZRPayload = z.infer<typeof payloadSchema>;

const iso = (v: string | undefined) => (v ? new Date(v).toISOString() : undefined);

export type ZRParcelState = {
  id: string;
  state?: { name?: string | null; slug?: string | null } | null;
  situation?: string | null;
  isReturn?: boolean | null;
  /** state timestamp (data.lastStateUpdateAt) */
  stateAt?: string;
  /** situation / isReturn timestamp */
  situationAt?: string;
};

/**
 * The one apply path (webhook, refresh, cron). State and situation go through
 * the RPC separately so a situation event can never block a late state event
 * and a null state can never wipe the stored one. Throws on RPC error.
 */
export async function applyZRParcelState(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  p: ZRParcelState,
): Promise<void> {
  const call = async (args: { state?: string; slug?: string | null; situation?: string | null; isReturn?: boolean | null }, at: string) => {
    const { error } = await admin.rpc("apply_zr_state", {
      p_ws: workspaceId,
      p_parcel: p.id,
      // explicit nulls (an omitted key would not resolve the function); generated arg types are non-null
      p_state: (args.state ?? null) as string, // null = situation path
      p_slug: (args.slug ?? null) as string,
      p_situation: (args.situation ?? null) as string,
      p_is_return: (args.isReturn ?? null) as boolean,
      p_occurred: at,
    });
    if (error) throw new Error(error.message);
  };
  const stateName = p.state?.name?.trim();
  if (stateName && p.stateAt) await call({ state: stateName, slug: p.state?.slug }, p.stateAt);
  const at = p.situationAt ?? p.stateAt;
  if ((p.situation != null || p.isReturn != null) && at) await call({ situation: p.situation, isReturn: p.isReturn }, at);
}

export async function processZRWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  if (body.length > MAX_WEBHOOK_BYTES) return jsonResponse({ error: "payload too large" }, 413);
  const headers: SvixHeaders = {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  };

  // Cheap rejects before any DB work: Svix always sends all three headers and
  // a fresh timestamp, so junk/stale requests cost no query and no row.
  const tsNum = Number(headers.timestamp);
  if (!headers.id || !headers.signature || !Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_SECONDS) {
    return jsonResponse({ error: "invalid signature" }, 401);
  }

  const supabase = await createAdminClient();
  const { data: configs } = await supabase
    .from("integration_configs")
    .select("workspace_id, secret")
    .eq("provider", "zrexpress")
    .eq("is_active", true);
  // ponytail: O(workspaces) HMACs per event — fine until thousands of tenants; then key by URL token.
  const integration = (configs ?? []).find((c) => c.secret && verifyZRWebhookSignature(c.secret, body, headers)) ?? null;
  const signatureOk = !!integration;

  // A row exists from a previous delivery: processed => duplicate; unprocessed
  // (earlier apply failed) => reuse it and apply again.
  let eventId: string | null = null;
  if (integration) {
    const { data: seen } = await supabase
      .from("webhook_events")
      .select("id, processed_at")
      .eq("provider", "zrexpress")
      .eq("workspace_id", integration.workspace_id)
      .eq("external_id", headers.id)
      .maybeSingle();
    if (seen?.processed_at) return jsonResponse({ ok: true, duplicate: true }, 200);
    eventId = seen?.id ?? null;
  }

  let payload: ZRPayload = {};
  let parseError: string | null = null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(body));
    if (parsed.success) payload = parsed.data;
    else parseError = "unexpected payload shape";
  } catch {
    parseError = "invalid json";
  }

  const eventType = payload.eventType ?? payload.type;
  const stateAt = iso(payload.data?.lastStateUpdateAt) ?? iso(payload.occurredAt);
  const situationAt = iso(payload.occurredAt) ?? iso(payload.data?.lastStateUpdateAt);
  const isState = eventType === "parcel.state.updated";
  const isSituation = eventType === "parcel.state.situation.created" || eventType === "parcel.isReturn.updated";
  if (!parseError && (isState || isSituation) && !(isState ? stateAt : situationAt)) parseError = "missing or invalid timestamp";

  const rejected = !configs?.length ? "integration not configured" : !signatureOk ? "invalid signature" : parseError;
  const row = {
    workspace_id: integration?.workspace_id ?? null,
    provider: "zrexpress" as const,
    external_id: signatureOk ? headers.id : null,
    signature_ok: signatureOk,
    payload: (!signatureOk ? { _rejected: true, bytes: body.length } : parseError ? { _unparsable: body.slice(0, 5000) } : payload) as NonNullable<Json>,
    error: rejected,
  };
  if (rejected) {
    // terminal: logged as processed so a same-id retry is a duplicate, not a re-run
    await supabase.from("webhook_events").insert({ ...row, processed_at: new Date().toISOString() });
    return jsonResponse({ error: rejected }, rejected === "invalid signature" || rejected === "integration not configured" ? 401 : 400);
  }
  const ws = integration!.workspace_id;
  if (!eventId) {
    const ins = await supabase.from("webhook_events").insert({ ...row, processed_at: null }).select("id").single();
    if (ins.error) {
      if (ins.error.code !== "23505") return jsonResponse({ error: "storage failure" }, 500);
      return jsonResponse({ ok: true, duplicate: true }, 200); // concurrent delivery of the same svix-id is already in flight
    }
    eventId = ins.data.id;
  }

  try {
    const parcelId = payload.data?.id;
    if (parcelId && (isState || isSituation)) {
      await applyZRParcelState(supabase, ws, {
        id: parcelId,
        state: isState ? payload.data?.state : undefined,
        situation: isSituation ? payload.data?.situation?.slug : undefined,
        isReturn: isSituation ? payload.data?.isReturn : undefined,
        stateAt,
        situationAt,
      });
    }
  } catch (e) {
    await supabase.from("webhook_events").update({ error: e instanceof Error ? e.message.slice(0, 500) : "apply failed" }).eq("id", eventId);
    return jsonResponse({ error: "apply failed" }, 500); // Svix retries with the same svix-id
  }
  await supabase.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", eventId);
  await supabase
    .from("integration_configs")
    .update({ last_event_at: new Date().toISOString() })
    .eq("workspace_id", ws)
    .eq("provider", "zrexpress");

  return jsonResponse({ ok: true }, 200);
}
