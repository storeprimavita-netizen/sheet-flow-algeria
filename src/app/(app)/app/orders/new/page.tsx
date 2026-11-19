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

  const [{ data: products }, { data: wilayas }, { data: fees }, communeRows] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, sale_price, images, status")
      .eq("is_active", true)
      .order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase
      .from("wilaya_fees")
      .select("wilaya_code, home_fee, stopdesk_fee, priced, stopdesk_available, stop_shipping"),
    loadCommunes(supabase),
  ]);

  const variantMap = await loadProductVariants(supabase, (products ?? []).map((p) => p.id));
  const withSizes = (products ?? []).map((p) => ({
    ...p,
    sizes: (variantMap.get(p.id)?.variants ?? []).filter((v) => v.isActive).map((v) => ({ id: v.id, label: v.label })),
  }));

  const feeMap = Object.fromEntries(
    (fees ?? []).map((f) => [
      f.wilaya_code,
      {
        home_fee: f.home_fee,
        stopdesk_fee: f.stopdesk_fee,
        priced: f.priced,
        stopdesk_available: f.stopdesk_available,
        stop_shipping: f.stop_shipping,
      },
    ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.new")} />
      <OrderForm products={withSizes} wilayas={wilayas ?? []} fees={feeMap} communes={communeRows} />
    </div>
  );
}

/** wilaya code -> commune names (RLS-scoped; paged because the API caps a page at 1000 rows). */
async function loadCommunes(supabase: Awaited<ReturnType<typeof createClient>>) {
  const out: Record<number, string[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("wilaya_communes")
      .select("wilaya_code, name")
      .order("wilaya_code")
      .order("name")
      .range(from, from + 999);
    for (const c of data ?? []) (out[c.wilaya_code] ??= []).push(c.name);
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}
