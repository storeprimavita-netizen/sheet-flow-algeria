"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { setSetting, SETTINGS_SCHEMAS, MEETING_SLOT_COUNT, zrStateKey } from "@/lib/settings";
import { MANUAL_DELIVERY_STATUSES } from "@/lib/enums";
import { CURRENCY_CODES } from "@/lib/enums";
import { fxRateFor } from "@/lib/fx";
import { replayEvent, lightfunnelProvider, shopifyProvider } from "@/lib/webhook";
import { searchZRTerritories, createZRWebhookEndpoint, getZRCredentials, getZRRates, zrErrorMessage } from "@/lib/integrations/zrexpress";
import type { Database } from "@/lib/supabase/database.types";
import {
  diffDeliveryPrices,
  parseDeliveryCsv,
  toApplyPayload,
  type DeliveryDiff,
  type StoredWilayaFee,
} from "@/lib/delivery-prices";

const num = (fd: FormData, name: string) => Number(fd.get(name) ?? 0);

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------
export async function renameWorkspace(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const name = z.string().trim().min(1).max(120).parse(String(formData.get("name") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ name }).eq("id", workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
const integrationSchema = z.object({
  provider: z.enum(["shopify", "lightfunnels"]),
  store_domain: z.string().trim(),
  secret: z.string().trim(),
});

export async function saveIntegration(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = integrationSchema.parse({
    provider: formData.get("provider"),
    store_domain: formData.get("store_domain"),
    secret: formData.get("secret"),
  });

  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["integration_configs"]["Insert"] = {
    workspace_id: workspaceId,
    provider: input.provider,
    config: { store_domain: input.store_domain },
  };
  if (input.secret) patch.secret = input.secret; // blank = keep existing secret

  const { error } = await supabase
    .from("integration_configs")
    .upsert(patch, { onConflict: "workspace_id,provider" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

export async function replayWebhookEvent(eventId: string) {
  const { workspaceId } = await adminProfile(); // admin-only gate; replayEvent uses the service-role client
  const { error } = await replayEvent(eventId, workspaceId);
  if (error) throw new Error(error);
  revalidatePath("/app/settings");
}

// Synthetic payloads for the "Send test event" button — obviously-tagged data
// (external_id `test-<ts>`, "Settings Test Event" customer) run through the
// *real* signature + mapping pipeline via an actual HTTP round trip, so a
// green result proves the URL and secret genuinely work end to end, the same
// as a real provider firing. Shows up as one recognizable order to delete.
const TEST_PAYLOAD_BUILDERS: Record<"shopify" | "lightfunnels", (id: string) => unknown> = {
  lightfunnels: (id) => ({
    id,
    total: 2500,
    customer: { full_name: "Settings Test Event", phone: "0555000000" },
    shipping_address: { city: "Alger", province: "Alger" },
    line_items: [{ quantity: 1 }],
  }),
  shopify: (id) => ({
    id,
    total_price: "2500",
    customer: { first_name: "Settings", last_name: "Test Event", phone: "0555000000" },
    shipping_address: { city: "Alger", province: "Alger" },
    line_items: [{ quantity: 1 }],
  }),
};

export async function sendTestWebhookEvent(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const provider = z.enum(["shopify", "lightfunnels"]).parse(formData.get("provider"));

  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("integration_configs")
    .select("secret")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (!cfg?.secret) throw new Error("Set a secret before sending a test event.");

  const config = provider === "shopify" ? shopifyProvider : lightfunnelProvider;
  const body = JSON.stringify(TEST_PAYLOAD_BUILDERS[provider](`test-${Date.now()}`));
  const signature = createHmac("sha256", cfg.secret).update(body, "utf8").digest(config.encoding);
  const baseUrl = await resolveBaseUrl();

  const res = await fetch(`${baseUrl}/api/webhooks/${provider}`, {
    method: "POST",
    headers: { "content-type": "application/json", [config.signatureHeader]: signature },
    body,
  });
  if (!res.ok) throw new Error(`Test event failed (${res.status}).`);
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// ZR Express (delivery-company push integration)
// ---------------------------------------------------------------------------
const zrConfigSchema = z.object({
  tenant_id: z.string().trim().min(1),
  api_key: z.string().trim(),
});

export async function saveZRExpressConfig(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = zrConfigSchema.parse({
    tenant_id: formData.get("tenant_id"),
    api_key: formData.get("api_key"),
  });

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("integration_configs")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "zrexpress")
    .maybeSingle();
  const existingConfig = (existing?.config as { tenant_id?: string; api_key?: string } | null) ?? {};

  const { error } = await supabase.from("integration_configs").upsert(
    {
      workspace_id: workspaceId,
      provider: "zrexpress",
      config: {
        tenant_id: input.tenant_id,
        // blank = keep existing key (the input is a password field, never pre-filled)
        api_key: input.api_key || existingConfig.api_key,
      },
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

export async function syncZRTerritories() {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const creds = await getZRCredentials(supabase, workspaceId);

  let territories;
  try {
    territories = await searchZRTerritories(creds);
  } catch (e) {
    throw new Error(zrErrorMessage(e, "Failed to reach ZR Express."));
  }

  await supabase.from("zr_territories").delete().eq("workspace_id", workspaceId);
  if (territories.length) {
    const { error } = await supabase.from("zr_territories").insert(
      territories.map((t) => ({
        workspace_id: workspaceId,
        id: t.id,
        code: t.code,
        name: t.name,
        level: t.level,
        parent_id: t.parentId,
      })),
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath("/app/settings");
}

export async function registerZRWebhook() {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const creds = await getZRCredentials(supabase, workspaceId);
  const baseUrl = await resolveBaseUrl();

  let secret: string;
  try {
    ({ secret } = await createZRWebhookEndpoint(creds, `${baseUrl}/api/webhooks/zrexpress`));
  } catch (e) {
    throw new Error(zrErrorMessage(e, "Failed to reach ZR Express."));
  }

  const { error } = await supabase
    .from("integration_configs")
    .update({ secret, is_active: true })
    .eq("workspace_id", workspaceId)
    .eq("provider", "zrexpress");
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

const zrStateMapSchema = z
  .array(z.object({ state: z.string().trim().min(1).max(100), status: z.enum(MANUAL_DELIVERY_STATUSES) }))
  .max(200);

/** ZR state → our delivery_status. Unmapped states just mirror on the shipment. */
export async function saveZRStateMap(entries: { state: string; status: string }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId } = await adminProfile();
  const parsed = zrStateMapSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mapping" };
  const map = Object.fromEntries(parsed.data.map((e) => [zrStateKey(e.state), e.status]));
  const res = await setSetting(workspaceId, "zr_state_map", { map });
  revalidatePath("/app/settings");
  return res;
}

export async function setZRAutoPush(enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId } = await adminProfile();
  const res = await setSetting(workspaceId, "zr_auto_push", { enabled: z.boolean().parse(enabled) });
  revalidatePath("/app/settings");
  return res;
}

/** Pull ZR's effective per-wilaya prices into wilaya_fees (home + stop desk).
 * Only wilaya-level territories with a code; missing prices keep the old fee. */
export async function syncZRFees(): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  let rates;
  try {
    rates = await getZRRates(await getZRCredentials(supabase, workspaceId));
  } catch (e) {
    return { ok: false, error: zrErrorMessage(e, "Failed to reach ZR Express.") };
  }
  const [{ data: current }, { data: wilayas }] = await Promise.all([
    supabase.from("wilaya_fees").select("wilaya_code, home_fee, stopdesk_fee").eq("workspace_id", workspaceId),
    supabase.from("wilayas").select("code"),
  ]);
  const byCode = new Map((current ?? []).map((r) => [r.wilaya_code, r]));
  const known = new Set((wilayas ?? []).map((w) => w.code)); // FK: codes ZR knows but our wilayas table doesn't are skipped
  const rows = rates
    .filter((r) => r.territoryCode != null && (!r.level || /wilaya|city|state/i.test(r.level)) && (r.home != null || r.stopdesk != null))
    .map((r) => ({
      workspace_id: workspaceId,
      wilaya_code: r.territoryCode!,
      home_fee: r.home ?? byCode.get(r.territoryCode!)?.home_fee ?? 0,
      stopdesk_fee: r.stopdesk ?? byCode.get(r.territoryCode!)?.stopdesk_fee ?? 0,
    }))
    .filter((r) => known.has(r.wilaya_code));
  if (rows.length) {
    const { error } = await supabase.from("wilaya_fees").upsert(rows, { onConflict: "workspace_id,wilaya_code" });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/app/settings");
  return { ok: true, updated: rows.length };
}

// ---------------------------------------------------------------------------
// Delivery fees (wilaya_fees bulk grid)
// ---------------------------------------------------------------------------
const feeAmount = z.coerce.number().min(0);

/** Admin saves the grid. A disabled fee input is not submitted: keep the stored value.
 * "No price" never becomes 0 (it is `priced=false`). Refuses to overwrite a CSV apply
 * that landed after the grid was loaded (compares the snapshot's updated_at). */
export type FeesSaveState = { error: string; codes?: number[] } | undefined;

export async function saveWilayaFees(formData: FormData): Promise<FeesSaveState> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("wilaya_fees")
    .select("wilaya_code, home_fee, stopdesk_fee, stop_shipping, priced, stopdesk_available, updated_at")
    .eq("workspace_id", workspaceId);
  const stored = current ?? [];

  const snapshot = String(formData.get("snapshot") ?? "");
  const latest = stored.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "");
  if (snapshot && latest && new Date(snapshot).getTime() !== new Date(latest).getTime()) {
    return { error: "errStale" };
  }

  let invalid = false;
  const field = (name: string, fallback: number) => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return fallback;
    const r = feeAmount.safeParse(raw);
    if (!r.success) {
      invalid = true;
      return fallback;
    }
    return r.data;
  };

  const rows = stored
    .map((r) => {
      const priced = formData.get(`priced_${r.wilaya_code}`) === "on";
      return {
      workspace_id: workspaceId,
      wilaya_code: r.wilaya_code,
      home_fee: field(`home_${r.wilaya_code}`, r.home_fee),
      stopdesk_fee: field(`stopdesk_${r.wilaya_code}`, r.stopdesk_fee),
      stop_shipping: formData.get(`stop_${r.wilaya_code}`) === "on",
      priced,
      // the stop-desk switch is disabled (not posted) while unpriced: keep the stored value
      stopdesk_available: priced ? formData.get(`desk_${r.wilaya_code}`) === "on" : r.stopdesk_available,
      };
    })
    .filter((n) => {
      const r = stored.find((x) => x.wilaya_code === n.wilaya_code)!;
      return (
        r.home_fee !== n.home_fee ||
        r.stopdesk_fee !== n.stopdesk_fee ||
        r.stop_shipping !== n.stop_shipping ||
        r.priced !== n.priced ||
        r.stopdesk_available !== n.stopdesk_available
      );
    });

  if (invalid) return { error: "errInvalid" };

  // Re-enabling a wilaya (or its stop desk) must not go live at the 0 DZD stored while it was off.
  const zeroOn = rows.filter((n) => {
    const r = stored.find((x) => x.wilaya_code === n.wilaya_code)!;
    const homeOn = n.priced && !r.priced;
    const deskOn = n.priced && n.stopdesk_available && (!r.priced || !r.stopdesk_available);
    return (homeOn && n.home_fee <= 0) || (deskOn && n.stopdesk_fee <= 0);
  });
  if (zeroOn.length) return { error: "errNeedFee", codes: zeroOn.map((n) => n.wilaya_code) };

  if (rows.length) {
    const { error } = await supabase.from("wilaya_fees").upsert(rows, { onConflict: "workspace_id,wilaya_code" });
    if (error) return { error: "errSave" };
  }
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// Delivery prices CSV (preview, then apply). The file is parsed server-side both times.
// ---------------------------------------------------------------------------
const MAX_CSV_BYTES = 1024 * 1024;
const csvFileSchema = z
  .instanceof(File, { message: "No file" })
  .refine((f) => f.size > 0, "The file is empty")
  .refine((f) => f.size <= MAX_CSV_BYTES, "The file is larger than 1 MB");

export type DeliveryPreview =
  | { ok: true; diff: DeliveryDiff; snapshot: string; wilayaNames: Record<number, string> }
  | { ok: false; error: string };

async function readCsv(formData: FormData) {
  const file = csvFileSchema.safeParse(formData.get("file"));
  if (!file.success) return { parsed: null, error: file.error.issues[0]?.message ?? "Invalid file" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.data.arrayBuffer());
  } catch {
    return { parsed: null, error: "The file is not valid UTF-8" };
  }
  const parsed = parseDeliveryCsv(text);
  if (!parsed.wilayas.length) return { parsed: null, error: "No wilaya rows found in this file" };
  return { parsed, error: null };
}

async function loadStoredFees(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string) {
  const { data: fees } = await supabase
    .from("wilaya_fees")
    .select("wilaya_code, home_fee, stopdesk_fee, stop_shipping, priced, stopdesk_available, updated_at")
    .eq("workspace_id", workspaceId);
  const counts = new Map<number, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("wilaya_communes")
      .select("wilaya_code")
      .eq("workspace_id", workspaceId)
      .order("wilaya_code")
      .order("name")
      .range(from, from + 999);
    for (const c of data ?? []) counts.set(c.wilaya_code, (counts.get(c.wilaya_code) ?? 0) + 1);
    if ((data?.length ?? 0) < 1000) break;
  }
  const rows = fees ?? [];
  const stored: StoredWilayaFee[] = rows.map((r) => ({ ...r, communes: counts.get(r.wilaya_code) ?? 0 }));
  const snapshot = rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "");
  return { stored, snapshot };
}

export async function previewDeliveryCsv(formData: FormData): Promise<DeliveryPreview> {
  const { workspaceId } = await adminProfile();
  const read = await readCsv(formData);
  if (!read.parsed) return { ok: false, error: read.error };
  const supabase = await createClient();
  const [{ stored, snapshot }, { data: wilayas }] = await Promise.all([
    loadStoredFees(supabase, workspaceId),
    supabase.from("wilayas").select("code, name"),
  ]);
  return {
    ok: true,
    diff: diffDeliveryPrices(read.parsed, stored),
    snapshot,
    wilayaNames: Object.fromEntries((wilayas ?? []).map((w) => [w.code, w.name])),
  };
}

export async function applyDeliveryCsv(
  formData: FormData,
): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  const { workspaceId } = await adminProfile();
  const read = await readCsv(formData);
  if (!read.parsed) return { ok: false, error: read.error };
  const supabase = await createClient();
  const { snapshot } = await loadStoredFees(supabase, workspaceId);
  const expected = String(formData.get("snapshot") ?? "");
  if (snapshot && new Date(expected).getTime() !== new Date(snapshot).getTime()) {
    return { ok: false, error: "Fees changed since the preview. Upload the file again." };
  }
  const { data, error } = await supabase.rpc("apply_delivery_prices", { p: toApplyPayload(read.parsed) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/settings");
  revalidatePath("/app/orders");
  const changed = (data as { fees_changed?: number } | null)?.fees_changed ?? 0;
  return { ok: true, changed };
}

// ---------------------------------------------------------------------------
// Fixed fees (CRUD)
// ---------------------------------------------------------------------------
const fixedFeeSchema = z.object({
  label: z.string().trim().min(1),
  amount: z.coerce.number().min(0),
  currency: z.enum(CURRENCY_CODES),
});

export async function saveFixedFee(id: string | null, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = fixedFeeSchema.parse({
    label: formData.get("label"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
  });

  const supabase = await createClient();
  const fx_rate = await fxRateFor(supabase, workspaceId, input.currency);

  const { error } = id
    ? await supabase
        .from("fixed_fees")
        .update({ ...input, fx_rate })
        .eq("id", id)
        .eq("workspace_id", workspaceId)
    : await supabase.from("fixed_fees").insert({ workspace_id: workspaceId, ...input, fx_rate });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

export async function deleteFixedFee(id: string) {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fixed_fees")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// Exchange rates (append-only)
// ---------------------------------------------------------------------------
const exchangeRateSchema = z.object({
  currency: z.enum(["USD", "EUR"]),
  rate_dzd: z.coerce.number().positive(),
  valid_from: z.string().min(1),
});

export async function addExchangeRate(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = exchangeRateSchema.parse({
    currency: formData.get("currency"),
    rate_dzd: formData.get("rate_dzd"),
    valid_from: String(formData.get("valid_from") || new Date().toISOString().slice(0, 10)),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("exchange_rates").insert({ workspace_id: workspaceId, ...input });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// Engine rules (settings keys)
// ---------------------------------------------------------------------------
export async function saveEngineRules(formData: FormData) {
  const { workspaceId } = await adminProfile();

  const results = await Promise.all([
    setSetting(workspaceId, "return_fee", { amount: num(formData, "return_fee_amount") }),
    setSetting(workspaceId, "duplicate_window", { hours: num(formData, "duplicate_window_hours") }),
    setSetting(workspaceId, "risk_weights", {
      returned: num(formData, "risk_returned"),
      cancelled: num(formData, "risk_cancelled"),
      no_answer: num(formData, "risk_no_answer"),
    }),
    setSetting(workspaceId, "stop_shipping_rule", {
      min_orders: num(formData, "min_orders"),
      min_delivery_rate: num(formData, "min_delivery_rate"),
    }),
  ]);
  const failed = results.find((r) => !r.ok);
  if (failed && !failed.ok) throw new Error(failed.error);
  revalidatePath("/app/settings");
}

// ---------------------------------------------------------------------------
// Pricing defaults (settings key `pricing_defaults`, D50) — typed result, the
// form is too large for FormData and is validated by the strict schema.
// ---------------------------------------------------------------------------
export type PricingActionResult = { ok: true } | { ok: false; error: "invalid" | "failed" };

export async function savePricingDefaults(input: unknown): Promise<PricingActionResult> {
  const { workspaceId } = await adminProfile();
  const parsed = SETTINGS_SCHEMAS.pricing_defaults.safeParse(input);
  // the editor never submits an unset target: null would blank every price
  if (!parsed.success || parsed.data.target.value === null) return { ok: false, error: "invalid" };
  const res = await setSetting(workspaceId, "pricing_defaults", parsed.data);
  if (!res.ok) return { ok: false, error: "failed" };
  revalidatePath("/app/settings");
  revalidatePath("/app/products", "layout");
  return { ok: true };
}

/** Back to the built-in defaults = delete the row (audit logs the DELETE). */
export async function resetPricingDefaults(): Promise<PricingActionResult> {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("settings").delete().eq("workspace_id", workspaceId).eq("key", "pricing_defaults");
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/app/settings");
  revalidatePath("/app/products", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Meeting schedule (settings key)
// ---------------------------------------------------------------------------
export async function saveMeetingSchedule(formData: FormData) {
  const { workspaceId } = await adminProfile();

  const slots: { dow: number; time: string }[] = [];
  for (let i = 0; i < MEETING_SLOT_COUNT; i++) {
    const time = String(formData.get(`slot_time_${i}`) ?? "").trim();
    if (!time) continue;
    slots.push({ dow: num(formData, `slot_dow_${i}`), time });
  }

  const result = await setSetting(workspaceId, "meeting_schedule", { slots });
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/app/settings");
}
