import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ProductView } from "@/components/store/product-view";
import { ButtonLink } from "@/components/button-link";
import { CrumbRecord } from "@/components/breadcrumbs";
import { assembleProductPage } from "@/lib/store/data";
import { createClient } from "@/lib/supabase/server";
import "@/components/store/store.css";

import { requireStoreAdmin } from "../../../_lib/data";

// Draft preview: admin layout, session client, RLS decides. Never cached, never reachable from /s.
export const dynamic = "force-dynamic";

export default async function StorePagePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireStoreAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const t = await getTranslations("store.admin");
  const supabase = await createClient();

  const { data: page, error: pageError } = await supabase.from("store_pages").select("id, store_id, product_id, slug, title, blocks, seo").eq("id", id).maybeSingle();
  if (pageError) throw new Error(`store preview page: ${pageError.message}`);
  if (!page || !page.product_id) notFound();
  const [{ data: store, error: storeError }, { data: product, error: productError }] = await Promise.all([
    supabase.from("stores").select("id, workspace_id, slug, name, theme, settings").eq("id", page.store_id).maybeSingle(),
    supabase.from("products").select("id, name, sale_price, images, stock").eq("id", page.product_id).maybeSingle(),
  ]);
  if (storeError || productError) throw new Error(`store preview: ${(storeError ?? productError)?.message}`);
  if (!store || !product) notFound();
  const dto = await assembleProductPage(supabase, store, page, product);

  return (
    <div className="space-y-4">
      <div>
        <CrumbRecord label={page.title} href={`/app/store/pages/${id}`} tail={t("editor.preview")} />
        <p className="text-sm text-muted-foreground">{t("editor.previewHint")}</p>
      </div>
      <ButtonLink href={`/app/store/pages/${id}`} variant="outline" size="sm">
        {t("editor.title")}
      </ButtonLink>
      <div className="store-root overflow-hidden rounded-xl border border-border" dir="rtl" lang="ar">
        <ProductView dto={dto} />
      </div>
    </div>
  );
}
