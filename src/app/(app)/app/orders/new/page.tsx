import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { loadProductVariants } from "@/lib/catalog/variants-data";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  await requireAdmin("/app/orders");
  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: products }, { data: wilayas }, { data: fees }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, sale_price, images, status")
      .eq("is_active", true)
      .order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("wilaya_fees").select("wilaya_code, home_fee, stopdesk_fee"),
  ]);

  const variantMap = await loadProductVariants(supabase, (products ?? []).map((p) => p.id));
  const withSizes = (products ?? []).map((p) => ({
    ...p,
    sizes: (variantMap.get(p.id)?.variants ?? []).filter((v) => v.isActive).map((v) => ({ id: v.id, label: v.label })),
  }));

  const feeMap = Object.fromEntries(
    (fees ?? []).map((f) => [f.wilaya_code, { home_fee: f.home_fee, stopdesk_fee: f.stopdesk_fee }]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.new")} />
      <OrderForm products={withSizes} wilayas={wilayas ?? []} fees={feeMap} />
    </div>
  );
}
