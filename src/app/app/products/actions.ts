"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { fxRateFor } from "@/lib/fx";
import {
  PRODUCT_STATUSES,
  EXPENSE_CATEGORIES,
  CURRENCY_CODES,
  AD_KINDS,
  MANUAL_STOCK_REASONS,
} from "@/lib/enums";

export type UpdateResult = { ok: true } | { ok: false; error: string };

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

// "label | sku" per line, sku optional — the "simple jsonb list editor" the phase brief calls for.
function parseVariants(text: string): { label: string; sku?: string }[] {
  return lines(text).map((line) => {
    const [label, sku] = line.split("|").map((s) => s.trim());
    return sku ? { label, sku } : { label };
  });
}

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
    variants: parseVariants(String(formData.get("variants") ?? "")),
    images: lines(String(formData.get("images") ?? "")),
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
});

export async function addStockMovement(productId: string, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = stockMovementSchema.parse({
    delta: formData.get("delta"),
    reason: formData.get("reason"),
    note: formData.get("note"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_movements")
    .insert({ workspace_id: workspaceId, product_id: productId, ...input });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/products/${productId}/stock`);
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
