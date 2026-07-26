import { getTranslations } from "next-intl/server";

import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireAdmin("/app/products");
  const profile = (await getProfile())!;
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.new")} />
      <ProductForm workspaceId={profile.workspaceId} />
    </div>
  );
}
