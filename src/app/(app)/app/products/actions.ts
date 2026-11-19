"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { fxRateFor } from "@/lib/fx";
import { invalidateStorePublic } from "@/lib/store/invalidate";
import { isHttps } from "@/lib/store/url";
import { countBySizeSchema, uuid, variantConfigSchema } from "@/lib/variants";
import {
  PRODUCT_STATUSES,
  EXPENSE_CATEGORIES,
  CURRENCY_CODES,
  AD_KINDS,
  MANUAL_STOCK_REASONS,
} from "@/lib/enums";

export type UpdateResult = { ok: true } | { ok: false; error: string };

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
/** Image URLs are shown on the public store: https only. */
const imageLines = (text: string) => {
  const urls = lines(text);
  if (urls.some((u) => !isHttps(u))) throw new Error("Image links must start with https://");
  return urls;
};

const optionalNumber = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
}, z.number().min(0).nullable());

const optionalText = z.string().trim().optional().transform((v) => v || null);
const nullableUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() && v.trim() !== "__none" ? v.trim() : null),
  z.string().uuid().nullable(),
);

// ---------------------------------------------------------------------------
// Product (Details tab) — upserts `products` + its 1:1 `product_costs` row.
// ---------------------------------------------------------------------------
const productSchema = z.object({
  name: z.string().trim().min(1),
  sku: optionalText,
  category_option_id: nullableUuid,
  fabric_option_id: nullableUuid,
  status: z.enum(PRODUCT_STATUSES),
  sale_price: optionalNumber,
  notes: optionalText,
  sourcing_cost: z.coerce.number().min(0),
  sourcing_currency: z.enum(CURRENCY_CODES),
});

export async function saveProduct(id: string | null, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = productSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    category_option_id: formData.get("category_option_id"),
    fabric_option_id: formData.get("fabric_option_id"),
    status: formData.get("status"),
    sale_price: formData.get("sale_price"),
    notes: formData.get("notes"),
    sourcing_cost: formData.get("sourcing_cost"),
    sourcing_currency: formData.get("sourcing_currency"),
  });

  const supabase = await createClient();
  const patch = {
    workspace_id: workspaceId,
    name: input.name,
    sku: input.sku,
    category_option_id: input.category_option_id,
    fabric_option_id: input.fabric_option_id,
    status: input.status,
    sale_price: input.sale_price,
    notes: input.notes,
    is_active: formData.get("is_active") === "on",
    images: imageLines(String(formData.get("images") ?? "")),
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(patch).eq("id", id).eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("products").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    productId = data.id;
  }

  const fx_rate = await fxRateFor(supabase, workspaceId, input.sourcing_currency);
  const { error: costError } = await supabase.from("product_costs").upsert({
    product_id: productId!,
    workspace_id: workspaceId,
    sourcing_cost: input.sourcing_cost,
    sourcing_currency: input.sourcing_currency,
    fx_rate,
  });
  if (costError) throw new Error(costError.message);

  revalidatePath("/app/products");
  invalidateStorePublic(); // name, price, images, is_active show on the public page
  if (!id) redirect(`/app/products/${productId}`);
  revalidatePath(`/app/products/${productId}`);
}

export async function setProductStatus(id: string, formData: FormData) {
  return setProductStatusValue(id, String(formData.get("status")));
}

/** Client-callable status change (product card kebab) → {ok} for a toast. */
export async function setProductStatusValue(id: string, value: string): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = z.enum(PRODUCT_STATUSES).safeParse(value);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: parsed.data })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/products");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Expenses (per-product tab)
// ---------------------------------------------------------------------------
const expenseSchema = z.object({
  id: nullableUuid,
  product_id: nullableUuid,
  category: z.enum(EXPENSE_CATEGORIES),
  subcategory_option_id: nullableUuid,
  amount: z.coerce.number().min(0),
  currency: z.enum(CURRENCY_CODES),
  fx_rate: z.coerce.number().positive(),
  spent_on: z.string().min(1),
  note: optionalText,
  contact_id: nullableUuid,
  account_id: nullableUuid,
});

/**
 * Shared expense upsert — the SAME action behind `<ExpenseForm>` on the product
 * Expenses tab (product pre-filled) and Finance → Expenses (product optional).
 * `id`/`product_id` travel in the form so one component serves both places.
 */
export async function saveExpense(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = expenseSchema.safeParse({
    id: formData.get("id"),
    product_id: formData.get("product_id"),
    category: formData.get("category"),
    subcategory_option_id: formData.get("subcategory_option_id"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    fx_rate: formData.get("fx_rate"),
    spent_on: formData.get("spent_on"),
    note: formData.get("note"),
    contact_id: formData.get("contact_id"),
    account_id: formData.get("account_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  const patch = { workspace_id: workspaceId, ...input };
  const { error } = id
    ? await supabase.from("expenses").update(patch).eq("id", id).eq("workspace_id", workspaceId)
    : await supabase.from("expenses").insert(patch);
  if (error) return { ok: false, error: error.message };
  if (input.product_id) revalidatePath(`/app/products/${input.product_id}/expenses`);
  if (input.contact_id) revalidatePath(`/app/contacts/suppliers/${input.contact_id}`);
  revalidatePath("/app/finance/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock (per-product tab) — append-only; trigger maintains products.stock.
// Manual entry is limited to purchase/correction — delivered/returned are
// written by the order-status trigger only (Phase 5).
// ---------------------------------------------------------------------------
const stockMovementSchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0, "Delta can't be zero"),
  reason: z.enum(MANUAL_STOCK_REASONS),
  note: optionalText,
  variant_id: nullableUuid, // null = "Not assigned to a size" (explicit choice for a product with sizes)
});

export async function addStockMovement(productId: string, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = stockMovementSchema.parse({
    delta: formData.get("delta"),
    reason: formData.get("reason"),
    note: formData.get("note"),
    variant_id: formData.get("variant_id"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_movements")
    .insert({ workspace_id: workspaceId, product_id: productId, ...input });
  if (error) throw new Error(error.message);
  invalidateStorePublic();
  revalidatePath(`/app/products/${productId}/stock`);
  revalidatePath("/app/stock");
  revalidatePath("/app/products");
}

// ---------------------------------------------------------------------------
// Options, values and variants (STORE-1, D54). Ids are client-generated UUIDs, upserted by id:
// RLS (admin write, own workspace) and the composite FKs keep a foreign id from landing anywhere.
// Variants are deactivated, never deleted; a value or option still used by a variant cannot be removed.
// ---------------------------------------------------------------------------
export type VariantResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "duplicate_value" | "duplicate_variant" | "in_use" | "stale" | "failed"; error: string };

function variantFailure(error: { code?: string; message: string }): VariantResult {
  if (error.code === "23505" && error.message.includes("product_option_values_label_uniq")) return { ok: false, code: "duplicate_value", error: error.message };
  if (error.message.includes("same values") || error.message.includes("already has these values")) return { ok: false, code: "duplicate_variant", error: error.message };
  if (error.message === "incomplete size") return { ok: false, code: "invalid", error: error.message };
  if (error.message.includes("swatch needs a color option") || error.message.includes("product_options_one_color") || error.code === "23514")
    return { ok: false, code: "invalid", error: error.message };
  if (error.message === "stale") return { ok: false, code: "stale", error: error.message };
  if (error.code === "23503") return { ok: false, code: "in_use", error: error.message };
  return { ok: false, code: "failed", error: error.message };
}

/** One transaction in `save_variant_config` (00048): any refusal rolls the whole save back. */
export async function saveVariantConfig(productId: string, raw: unknown): Promise<VariantResult> {
  await adminProfile();
  const pid = uuid.safeParse(productId);
  const parsed = variantConfigSchema.safeParse(raw);
  if (!pid.success || !parsed.success) {
    const msg = parsed.success ? "Invalid product" : (parsed.error.issues[0]?.message ?? "Invalid input");
    return { ok: false, code: msg === "duplicate_value" ? "duplicate_value" : msg === "duplicate_variant" ? "duplicate_variant" : "invalid", error: msg };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_variant_config", { p_product: pid.data, p_config: parsed.data });
  if (error) return variantFailure(error);

  invalidateStorePublic();
  revalidatePath(`/app/products/${pid.data}`);
  revalidatePath(`/app/products/${pid.data}/stock`);
  revalidatePath("/app/stock");
  return { ok: true };
}

/** Count by size (D54.2): absolute shelf counts, one transaction in `stock_count_variants`. */
export async function countBySize(productId: string, raw: unknown): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  await adminProfile();
  const pid = uuid.safeParse(productId);
  const counts = countBySizeSchema.safeParse(raw);
  if (!pid.success || !counts.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_variants", { p_product: pid.data, p_counts: counts.data });
  if (error) return { ok: false, error: error.message };
  invalidateStorePublic();
  revalidatePath(`/app/products/${pid.data}/stock`);
  revalidatePath("/app/stock");
  revalidatePath("/app/products");
  return { ok: true, changed: data ?? 0 };
}

/** Per-product low-stock threshold (00023) — drives stock chips + dashboard alert. */
export async function setLowStockThreshold(productId: string, value: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await adminProfile();
  const parsed = z.number().int().min(0).max(100000).safeParse(value);
  if (!parsed.success) return { ok: false, error: "Threshold must be a whole number ≥ 0." };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ low_stock_threshold: parsed.data }).eq("id", z.string().uuid().parse(productId));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/stock");
  revalidatePath("/app/products");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ad-spend quick entry — shared widget (product page here; Dashboard in Ph.7)
// ---------------------------------------------------------------------------
const adSpendSchema = z.object({
  product_id: z.string().uuid(),
  spent_on: z.string().min(1),
  kind: z.enum(AD_KINDS),
  amount: z.coerce.number().min(0),
  currency: z.enum(CURRENCY_CODES),
  fx_rate: z.coerce.number().positive(),
  account_id: nullableUuid,
});

export async function upsertAdSpend(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await adminProfile();
  const parsed = adSpendSchema.safeParse({
    product_id: formData.get("product_id"),
    spent_on: formData.get("spent_on"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    fx_rate: formData.get("fx_rate"),
    account_id: formData.get("account_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_spend_daily")
    .upsert({ workspace_id: workspaceId, ...input }, { onConflict: "workspace_id,product_id,spent_on,kind" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/products/${input.product_id}/expenses`);
  revalidatePath("/app/finance/ad-spend");
  return { ok: true };
}
