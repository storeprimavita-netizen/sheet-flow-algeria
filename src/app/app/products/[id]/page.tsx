import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ProductForm } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/app/products");
  const profile = (await getProfile())!;
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.edit")} subtitle={product.name}>
        <DeleteButton table="products" id={product.id} redirectTo="/app/products" />
      </PageHeader>
      <ProductForm product={product} workspaceId={profile.workspaceId} />
    </div>
  );
}
