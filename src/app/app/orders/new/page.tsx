import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  await requireAdmin("/app/orders");
  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: products }, { data: wilayas }, { data: fees }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, sale_price, variants, images, status")
      .eq("is_active", true)
      .order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("wilaya_fees").select("wilaya_code, home_fee, stopdesk_fee"),
  ]);

  const feeMap = Object.fromEntries(
    (fees ?? []).map((f) => [f.wilaya_code, { home_fee: f.home_fee, stopdesk_fee: f.stopdesk_fee }]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.new")} />
      <OrderForm products={products ?? []} wilayas={wilayas ?? []} fees={feeMap} />
    </div>
  );
}
