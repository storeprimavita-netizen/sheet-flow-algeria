import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { DELIVERY_STATUSES } from "@/lib/enums";

/** Schemas for `settings.value` per key (docs/DB.md §settings keys). */
export const SETTINGS_SCHEMAS = {
  return_fee: z.object({ amount: z.number().min(0) }),
  duplicate_window: z.object({ hours: z.number().int().min(1) }),
  risk_weights: z.object({
    returned: z.number().min(0),
    cancelled: z.number().min(0),
    no_answer: z.number().min(0),
  }),
  stop_shipping_rule: z.object({
    min_orders: z.number().int().min(0),
    min_delivery_rate: z.number().min(0).max(100),
  }),
  meeting_schedule: z.object({
    slots: z.array(
      z.object({ dow: z.number().int().min(0).max(6), time: z.string().min(1) }),
    ),
  }),
  /** ZR state name (lower-cased, trimmed) → our delivery_status. ZR states are
   * per-tenant, so this is user-edited (Settings → ZR Express). */
  zr_state_map: z.object({ map: z.record(z.string(), z.enum(DELIVERY_STATUSES)) }),
  /** push a parcel to ZR automatically when an order is confirmed */
  zr_auto_push: z.object({ enabled: z.boolean() }),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

/** Seeded defaults — mirrors `seed_workspace()` in supabase/migrations/00002. */
const DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  return_fee: { amount: 150 },
  duplicate_window: { hours: 48 },
  risk_weights: { returned: 2, cancelled: 1, no_answer: 0.5 },
  stop_shipping_rule: { min_orders: 10, min_delivery_rate: 40 },
  meeting_schedule: { slots: [] },
  zr_state_map: { map: { livre: "delivered", encaisse: "delivered", recouvert: "delivered", recupere_par_fournisseur: "returned" } },
  zr_auto_push: { enabled: false },
};

/** Lookup key for zr_state_map — ZR state names vary in case/spacing. */
export const zrStateKey = (name: string) => name.trim().toLowerCase();

/** Fixed number of meeting-slot rows the Thresholds form renders (blank time = unused). */
export const MEETING_SLOT_COUNT = 5;

export async function getSetting<K extends SettingKey>(
  workspaceId: string,
  key: K,
): Promise<SettingValue<K>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("workspace_id", workspaceId)
    .eq("key", key)
    .maybeSingle();

  if (!data) return DEFAULTS[key];
  const parsed = SETTINGS_SCHEMAS[key].safeParse(data.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : DEFAULTS[key];
}

export async function setSetting<K extends SettingKey>(
  workspaceId: string,
  key: K,
  value: SettingValue<K>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = SETTINGS_SCHEMAS[key].safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ workspace_id: workspaceId, key, value: parsed.data }, { onConflict: "workspace_id,key" });

  return error ? { ok: false, error: error.message } : { ok: true };
}
