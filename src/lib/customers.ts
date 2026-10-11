import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Mirrors the SQL `normalize_dz_phone()` (supabase/migrations/00001_core.sql)
 * exactly — used here for the customer lookup query, since the DB trigger
 * normalizes on write but a lookup needs the same value client-side first.
 */
export function normalizeDzPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^00213[567]\d{8}$/.test(digits)) return "0" + digits.slice(5);
  if (/^213[567]\d{8}$/.test(digits)) return "0" + digits.slice(3);
  if (/^[567]\d{8}$/.test(digits)) return "0" + digits;
  return digits;
}

/**
 * Find-or-create the customer for an order's phone (workspace-scoped, keyed
 * by normalized phone). Used by manual order creation and, in Phase 6, by
 * the webhook handlers. Returns the customer id to link on the order.
 */
export async function upsertCustomerFromOrder(
  supabase: SupabaseClient<Database>,
  params: {
    workspaceId: string;
    name: string;
    phone: string;
    wilayaCode?: number | null;
    commune?: string | null;
    address?: string | null;
  },
): Promise<string> {
  const phone = normalizeDzPhone(params.phone);

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("customers")
      .update({
        name: params.name,
        wilaya_code: params.wilayaCode ?? null,
        commune: params.commune ?? null,
        address: params.address ?? null,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      workspace_id: params.workspaceId,
      name: params.name,
      phone: params.phone, // raw; the DB trigger normalizes `phone` and keeps `phone_raw`
      wilaya_code: params.wilayaCode ?? null,
      commune: params.commune ?? null,
      address: params.address ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** wa.me deep link for a DZ number (05/06/07…, +213, 00213 all accepted). */
export function whatsappHref(raw: string): string {
  const local = normalizeDzPhone(raw);
  return `https://wa.me/${local.startsWith("0") ? "213" + local.slice(1) : local}`;
}
