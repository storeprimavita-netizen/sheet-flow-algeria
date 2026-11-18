"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/rbac";
import { blocksSchema, seoSchema } from "@/lib/store/blocks";
import { invalidateStorePublic } from "@/lib/store/invalidate";
import { storeSettingsSchema } from "@/lib/store/settings";
import { slugSchema, storeSlugSchema } from "@/lib/store/url";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type StoreResult = { ok: true; id?: string } | { ok: false; error: "invalid" | "slug_taken" | "product_taken" | "exists" | "needs_product" | "forbidden" | "failed" };

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
  if (existing.data?.length) return fail("exists");
  const { data, error } = await supabase
    .from("stores")
    .insert({ workspace_id: workspaceId, slug: input.data.slug, name: input.data.name })
    .select("id")
    .single();
  if (error) return dbFail(error);
  // two quick requests can both pass the check above: the oldest store wins, the loser removes its own row
  const { data: all } = await supabase.from("stores").select("id").eq("workspace_id", workspaceId).order("created_at").order("id");
  if (all && all.length > 1 && all[0].id !== data.id) {
    await supabase.from("stores").delete().eq("id", data.id);
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
  const { data, error } = await supabase
    .from("store_pages")
    .update({ product_id: ids.data.productId })
    .eq("id", ids.data.pageId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done(`/app/store/pages/${pageId}`);
  return { ok: true, id: pageId };
}

async function setPublished(pageId: string, publish: boolean): Promise<StoreResult> {
  const { workspaceId } = await requireAdminProfile();
  const id = uuid.safeParse(pageId);
  if (!id.success) return fail("invalid");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_pages")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("failed");
  done(`/app/store/pages/${id.data}`);
  return { ok: true, id: id.data };
}
export const publishPage = async (pageId: string) => setPublished(pageId, true);
export const unpublishPage = async (pageId: string) => setPublished(pageId, false);
