"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/rbac";
import { blocksSchema, seoSchema } from "@/lib/store/blocks";
import { isVerifiedOrder } from "@/lib/store/reviews";
import { invalidateStorePublic } from "@/lib/store/invalidate";
import { storeSettingsSchema } from "@/lib/store/settings";
import { slugSchema, storeSlugSchema, stripEmoji } from "@/lib/store/url";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type StoreResult = { ok: true; id?: string } | { ok: false; error: "invalid" | "slug_taken" | "product_taken" | "exists" | "needs_product" | "order_not_found" | "order_not_verifiable" | "forbidden" | "failed" };

const fail = (error: Extract<StoreResult, { ok: false }>["error"]): StoreResult => ({ ok: false, error });
const dbFail = (e: { code?: string; message: string }): StoreResult =>
  e.code === "23505" ? fail(e.message.includes("product_id") ? "product_taken" : "slug_taken") : e.message.includes("violates check constraint") ? fail("needs_product") : fail("failed");

const name = z.string().trim().min(1).max(80);
const uuid = z.uuid();

function done(extra?: string) {
  invalidateStorePublic();
  revalidatePath("/app/store", "layout");
  if (extra) revalidatePath(extra);
}

const createStoreSchema = z.object({ slug: storeSlugSchema, name });
/** One store per workspace in the UI for now (the DB allows several). */
export async function createStore(formData: FormData): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = createStoreSchema.safeParse({ slug: formData.get("slug"), name: formData.get("name") });
  if (!input.success) return fail("invalid");
  const supabase = await createClient();
  const existing = await supabase.from("stores").select("id").eq("workspace_id", workspaceId).limit(1);
  if (existing.error) return fail("failed");
  if (existing.data?.length) return fail("exists");
  const { data, error } = await supabase
    .from("stores")
    .insert({ workspace_id: workspaceId, slug: input.data.slug, name: input.data.name })
    .select("id")
    .single();
  if (error) return dbFail(error);
  // two quick requests can both pass the check above: the oldest store wins, the loser removes its own row
  const { data: all, error: allError } = await supabase.from("stores").select("id").eq("workspace_id", workspaceId).order("created_at").order("id");
  if (allError || !all) return fail("failed");
  if (all.length > 1 && all[0].id !== data.id) {
    const del = await supabase.from("stores").delete().eq("id", data.id).select("id");
    // if our row could not be removed, two stores exist: report a failure, not "exists"
    if (del.error || !del.data?.length) return fail("failed");
    return fail("exists");
  }
  done();
  return { ok: true, id: data.id };
}

const saveStoreSchema = z.object({
  id: uuid,
  name,
  slug: storeSlugSchema,
  status: z.enum(["draft", "live"]),
  settings: storeSettingsSchema,
});
export async function saveStoreSettings(raw: unknown): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = saveStoreSchema.safeParse(raw);
  if (!input.success) return fail("invalid");
  const { id, ...rest } = input.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .update({ name: rest.name, slug: rest.slug, status: rest.status, settings: rest.settings as NonNullable<Json> })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done("/app/store/settings");
  return { ok: true, id };
}

const createPageSchema = z.object({ store_id: uuid, product_id: uuid, title: name, slug: slugSchema });
export async function createPage(formData: FormData): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = createPageSchema.safeParse({
    store_id: formData.get("store_id"),
    product_id: formData.get("product_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
  });
  if (!input.success) return fail("invalid");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_pages")
    .insert({ workspace_id: workspaceId, kind: "product", ...input.data })
    .select("id")
    .single();
  if (error) return dbFail(error);
  done("/app/store/pages");
  return { ok: true, id: data.id };
}

const savePageSchema = z.object({ id: uuid, title: name, slug: slugSchema, blocks: blocksSchema, seo: seoSchema });
export async function savePage(raw: unknown): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = savePageSchema.safeParse(raw);
  if (!input.success) return fail("invalid");
  const { id, ...rest } = input.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_pages")
    .update({ title: rest.title, slug: rest.slug, blocks: rest.blocks as NonNullable<Json>, seo: rest.seo as NonNullable<Json> })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done(`/app/store/pages/${id}`);
  return { ok: true, id };
}

/** Link or unlink the product of a page. A published page cannot lose its product. */
export async function linkPageProduct(pageId: string, productId: string | null): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const ids = z.object({ pageId: uuid, productId: uuid.nullable() }).safeParse({ pageId, productId });
  if (!ids.success) return fail("invalid");
  const supabase = await createClient();
  const { data: page, error: pageError } = await supabase.from("store_pages").select("status").eq("id", ids.data.pageId).eq("workspace_id", workspaceId).maybeSingle();
  if (pageError || !page) return fail("failed");
  if (page.status === "published" && (!ids.data.productId || !(await assertPublishable(supabase, ids.data.productId)))) return fail("needs_product");
  const { data, error } = await supabase
    .from("store_pages")
    .update({ product_id: ids.data.productId })
    .eq("id", ids.data.pageId)
    .eq("status", page.status)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done(`/app/store/pages/${pageId}`);
  return { ok: true, id: pageId };
}

/** A page can only answer 200 when its product is active and priced. */
async function assertPublishable(supabase: Awaited<ReturnType<typeof createClient>>, productId: string): Promise<boolean> {
  const { data: pr, error } = await supabase.from("products").select("is_active, sale_price").eq("id", productId).maybeSingle();
  if (error) throw new Error(`assertPublishable: ${error.message}`);
  return !!pr?.is_active && pr.sale_price !== null;
}

async function setPublished(pageId: string, publish: boolean): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const id = uuid.safeParse(pageId);
  if (!id.success) return fail("invalid");
  const supabase = await createClient();
  let productId: string | null = null;
  if (publish) {
    // the UI disables Publish, but a direct call must not publish a page that would answer 404
    const { data: pg, error: pgError } = await supabase.from("store_pages").select("product_id").eq("id", id.data).eq("workspace_id", workspaceId).maybeSingle();
    if (pgError) throw new Error(`setPublished: ${pgError.message}`);
    if (!pg?.product_id || !(await assertPublishable(supabase, pg.product_id))) return fail("needs_product");
    productId = pg.product_id;
  }
  let update = supabase
    .from("store_pages")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("workspace_id", workspaceId);
  // publish only the product that was just checked: an unlink in between must not slip through
  if (productId) update = update.eq("product_id", productId);
  const { data, error } = await update.select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail(publish ? "needs_product" : "failed");
  done(`/app/store/pages/${id.data}`);
  return { ok: true, id: id.data };
}
export const publishPage = async (pageId: string) => setPublished(pageId, true);
export const unpublishPage = async (pageId: string) => setPublished(pageId, false);

const createReviewSchema = z.object({
  product_id: uuid,
  name,
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(1000).refine((v) => stripEmoji(v).trim().length > 0),
  order_seq: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.coerce.number().int().positive().max(2147483647).optional()),
  // the admin confirms the customer agreed to be quoted; never prefilled from the order
  agreed: z.literal("on"),
});
/** Records a review (not visible until approved). An order #, when given, must verify for this product or the review is refused. */
export async function createReview(formData: FormData): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = createReviewSchema.safeParse({
    product_id: formData.get("product_id"),
    name: formData.get("name"),
    rating: formData.get("rating"),
    body: formData.get("body"),
    order_seq: formData.get("order_seq") ?? "",
    agreed: formData.get("agreed"),
  });
  if (!input.success) return fail("invalid");
  const supabase = await createClient();
  let orderId: string | null = null;
  if (input.data.order_seq !== undefined) {
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, product_id, confirmation_status, excluded_reason")
      .eq("order_seq", input.data.order_seq)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (orderErr) return fail("failed");
    if (!order) return fail("order_not_found");
    if (!isVerifiedOrder(order, input.data.product_id)) return fail("order_not_verifiable");
    orderId = order.id;
  }
  const { data, error } = await supabase
    .from("reviews")
    .insert({ workspace_id: workspaceId, product_id: input.data.product_id, name: input.data.name, rating: input.data.rating, body: input.data.body, order_id: orderId })
    .select("id")
    .single();
  if (error) return dbFail(error);
  done("/app/store/reviews");
  return { ok: true, id: data.id };
}

export async function setReviewApproved(reviewId: string, approved: boolean): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const input = z.object({ id: uuid, approved: z.boolean() }).safeParse({ id: reviewId, approved });
  if (!input.success) return fail("invalid");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ approved: input.data.approved })
    .eq("id", input.data.id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done("/app/store/reviews");
  return { ok: true, id: input.data.id };
}

export async function deleteReview(reviewId: string): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const id = uuid.safeParse(reviewId);
  if (!id.success) return fail("invalid");
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").delete().eq("id", id.data).eq("workspace_id", workspaceId).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done("/app/store/reviews");
  return { ok: true, id: id.data };
}
