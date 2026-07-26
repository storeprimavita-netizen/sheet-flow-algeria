import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.new")} />
      <ProductForm />
    </div>
  );
}
