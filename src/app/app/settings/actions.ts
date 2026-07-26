"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { setSetting, MEETING_SLOT_COUNT } from "@/lib/settings";
import { CURRENCY_CODES } from "@/lib/enums";
import { fxRateFor } from "@/lib/fx";
import type { Database } from "@/lib/supabase/database.types";

const num = (fd: FormData, name: string) => Number(fd.get(name) ?? 0);

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
// Thresholds (settings keys)
// ---------------------------------------------------------------------------
export async function saveThresholds(formData: FormData) {
  const { workspaceId } = await adminProfile();

  const slots: { dow: number; time: string }[] = [];
  for (let i = 0; i < MEETING_SLOT_COUNT; i++) {
    const time = String(formData.get(`slot_time_${i}`) ?? "").trim();
    if (!time) continue;
    slots.push({ dow: num(formData, `slot_dow_${i}`), time });
  }

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
    setSetting(workspaceId, "meeting_schedule", { slots }),
  ]);
  const failed = results.find((r) => !r.ok);
  if (failed && !failed.ok) throw new Error(failed.error);
  revalidatePath("/app/settings");
}
