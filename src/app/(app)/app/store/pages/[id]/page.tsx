import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { blocksSchema, seoSchema } from "@/lib/store/blocks";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

import { Crumbs } from "../../_components/crumbs";
import { PageEditor } from "../../_components/page-editor";
import { getStore, requireStoreAdmin } from "../../_lib/data";

export default async function StorePageEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireStoreAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const t = await getTranslations("store.admin");
  const supabase = await createClient();
  const [store, { data: page }] = await Promise.all([
    getStore(),
    supabase.from("store_pages").select("id, title, slug, status, product_id, blocks, seo").eq("id", id).maybeSingle(),
  ]);
  if (!page || !store) notFound();

  const [{ data: products }, { data: used }] = await Promise.all([
    supabase.from("products").select("id, name, is_active, sale_price").order("name"),
    supabase.from("store_pages").select("product_id").eq("store_id", store.id).neq("id", id),
  ]);
  const taken = new Set((used ?? []).map((u) => u.product_id));
  const linked = (products ?? []).find((p) => p.id === page.product_id);
  const blocks = blocksSchema.safeParse(page.blocks);
  const seo = seoSchema.safeParse(page.seo);

  return (
    <div className="space-y-6">
      <div>
        <Crumbs items={[{ label: t("pages.title"), href: "/app/store/pages" }, { label: page.title }]} />
        <PageHeader title={t("editor.title")} subtitle={t("editor.purpose")} />
      </div>
      <PageEditor
        key={`${page.id}-${page.slug}-${page.status}`}
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          productId: page.product_id,
          productOk: !!linked && linked.is_active && linked.sale_price !== null,
          blocks: blocks.success ? blocks.data : [],
          seo: seo.success ? seo.data : {},
        }}
        store={{ slug: store.slug, status: store.status }}
        products={(products ?? []).filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
