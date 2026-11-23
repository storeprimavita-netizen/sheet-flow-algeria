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

function done(productId: string) {
  invalidateStorePublic();
  revalidatePath(`/app/catalog/products/${productId}/selling`);
}

export async function savePricing(input: unknown): Promise<SellingResult> {
  const parsed = pricingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const g = await guard(v.productId);
  if (!g) return { ok: false, error: "notFound" };

  const { error } = await g.supabase.rpc("save_product_pricing", {
    p_product: v.productId,
    p_mode: v.mode,
    p_compare_at: v.compareAt ?? undefined,
    p_deltas: v.deltas,
    p_overrides: v.overrides,
  });
  if (error) return { ok: false, error: "failed" };
  done(v.productId);
  return { ok: true };
}

/** Returned quantity IDs follow the order of the submitted rows. */
export async function saveOffers(input: unknown): Promise<SellingResult<{ offerIds: string[] }>> {
  const parsed = offersInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const g = await guard(v.productId);
  if (!g) return { ok: false, error: "notFound" };

  const { data, error } = await g.supabase.rpc("save_product_offers", {
    p_product: v.productId,
    p_offers: v.offers,
    p_bump: v.bump,
  });
  if (error) return { ok: false, error: /bump/i.test(error.message) ? "bump" : "failed" };
  done(v.productId);
  return { ok: true, offerIds: data };
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
  done(v.productId);
  return { ok: true };
}
