"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { setSetting, MEETING_SLOT_COUNT } from "@/lib/settings";
import { CURRENCY_CODES } from "@/lib/enums";
import { fxRateFor } from "@/lib/fx";
import { replayEvent, lightfunnelProvider, shopifyProvider } from "@/lib/webhook";
import { searchZRTerritories, createZRWebhookEndpoint, getZRCredentials, zrErrorMessage } from "@/lib/integrations/zrexpress";
import type { Database } from "@/lib/supabase/database.types";

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

// ---------------------------------------------------------------------------
// Delivery fees (wilaya_fees bulk grid)
// ---------------------------------------------------------------------------
const feeAmount = z.coerce.number().min(0).catch(0);

export async function saveWilayaFees(formData: FormData) {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();

  const { data: codes } = await supabase
    .from("wilaya_fees")
    .select("wilaya_code")
    .eq("workspace_id", workspaceId);

  const rows = (codes ?? []).map(({ wilaya_code }) => ({
    workspace_id: workspaceId,
    wilaya_code,
    home_fee: feeAmount.parse(formData.get(`home_${wilaya_code}`)),
    stopdesk_fee: feeAmount.parse(formData.get(`stopdesk_${wilaya_code}`)),
    stop_shipping: formData.get(`stop_${wilaya_code}`) === "on",
  }));

  const { error } = await supabase
    .from("wilaya_fees")
    .upsert(rows, { onConflict: "workspace_id,wilaya_code" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
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
