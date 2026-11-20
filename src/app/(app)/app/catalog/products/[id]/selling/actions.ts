"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/lib/rbac";
import { normalizeFormFields } from "@/lib/store/form-fields";
import { invalidateStorePublic } from "@/lib/store/invalidate";
import { formInputSchema, offersInputSchema, pricingInputSchema, type SellingResult } from "@/lib/store/selling-schemas";
import { createClient } from "@/lib/supabase/server";

/** Admin re-check + product in my workspace. Session client: RLS stays the wall. */
async function guard(productId: string) {
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id").eq("id", productId).eq("workspace_id", workspaceId).maybeSingle();
  return data ? { supabase, workspaceId } : null;
}

const done = (productId: string): SellingResult => {
  invalidateStorePublic();
  revalidatePath(`/app/products/${productId}/selling`);
  return { ok: true };
};

/** Mode, compare price, per-value deltas and per-size overrides. Idempotent: a retry re-sends everything. */
export async function savePricing(input: unknown): Promise<SellingResult> {
  const parsed = pricingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const g = await guard(v.productId);
  if (!g) return { ok: false, error: "notFound" };
  const { supabase } = g;

  for (const d of v.deltas) {
    const { error } = await supabase.from("product_option_values").update({ price_delta: d.delta }).eq("id", d.valueId).eq("product_id", v.productId);
    if (error) return { ok: false, error: "failed" };
  }
  for (const o of v.overrides) {
    const { error } = await supabase
      .from("product_variants")
      .update({ price_override: o.price, compare_at_override: o.compareAt })
      .eq("id", o.variantId)
      .eq("product_id", v.productId);
    if (error) return { ok: false, error: "failed" };
  }
  const { error } = await supabase.from("products").update({ pricing_mode: v.mode, compare_at_price: v.compareAt }).eq("id", v.productId);
  if (error) return { ok: false, error: "failed" };
  return done(v.productId);
}

/** Quantity offers (replaced as a list, order = position) and the single bump. */
export async function saveOffers(input: unknown): Promise<SellingResult> {
  const parsed = offersInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const g = await guard(v.productId);
  if (!g) return { ok: false, error: "notFound" };
  const { supabase, workspaceId } = g;

  const { data: existing, error: readErr } = await supabase.from("product_offers").select("id, kind").eq("product_id", v.productId);
  if (readErr) return { ok: false, error: "failed" };
  const keep = new Set(v.offers.flatMap((o) => (o.id ? [o.id] : [])));
  const gone = (existing ?? []).filter((r) => r.kind === "quantity" && !keep.has(r.id)).map((r) => r.id);
  if (gone.length) {
    const { error } = await supabase.from("product_offers").delete().in("id", gone).eq("product_id", v.productId);
    if (error) return { ok: false, error: "failed" };
  }
  // clear the default first so moving it never collides with the one-default index
  const { error: clearErr } = await supabase.from("product_offers").update({ is_default: false }).eq("product_id", v.productId).eq("kind", "quantity");
  if (clearErr) return { ok: false, error: "failed" };

  for (const [position, o] of v.offers.entries()) {
    const row = {
      workspace_id: workspaceId,
      product_id: v.productId,
      kind: "quantity" as const,
      label: o.label,
      qty: o.qty,
      total_price: o.total,
      is_default: o.isDefault,
      is_active: o.isActive,
      active_from: o.activeFrom,
      active_to: o.activeTo,
      position,
    };
    const { error } = o.id
      ? await supabase.from("product_offers").update(row).eq("id", o.id).eq("product_id", v.productId)
      : await supabase.from("product_offers").insert(row);
    if (error) return { ok: false, error: "failed" };
  }

  const bumpRow = (existing ?? []).find((r) => r.kind === "bump");
  if (!v.bump) {
    if (bumpRow) {
      const { error } = await supabase.from("product_offers").delete().eq("id", bumpRow.id).eq("product_id", v.productId);
      if (error) return { ok: false, error: "failed" };
    }
  } else {
    const row = {
      workspace_id: workspaceId,
      product_id: v.productId,
      kind: "bump" as const,
      label: v.bump.label,
      bump_product_id: v.bump.productId,
      bump_price: v.bump.price,
      is_active: v.bump.isActive,
    };
    const { error } = bumpRow
      ? await supabase.from("product_offers").update(row).eq("id", bumpRow.id).eq("product_id", v.productId)
      : await supabase.from("product_offers").insert(row);
    if (error) return { ok: false, error: /bump/i.test(error.message) ? "bump" : "failed" };
  }
  return done(v.productId);
}

export async function saveForm(input: unknown): Promise<SellingResult> {
  const parsed = formInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const g = await guard(v.productId);
  if (!g) return { ok: false, error: "notFound" };
  const { error } = await g.supabase
    .from("product_forms")
    .upsert(
      { product_id: v.productId, workspace_id: g.workspaceId, fields: normalizeFormFields(v.fields), delivery_methods: v.deliveryMethods },
      { onConflict: "product_id" },
    );
  if (error) return { ok: false, error: "failed" };
  return done(v.productId);
}
