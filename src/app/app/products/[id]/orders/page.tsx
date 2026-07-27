import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ProductOrdersTable, type ProductOrderRow } from "./product-orders-table";

export default async function ProductOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: product }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id").eq("id", id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, placed_at, customer_name, quantity, sale_price, confirmation_status, delivery_status")
      .eq("product_id", id)
      .order("placed_at", { ascending: false })
      .limit(200),
  ]);
  if (!product) notFound();

  const rows: ProductOrderRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    placed_at: o.placed_at,
    customer_name: o.customer_name,
    quantity: o.quantity,
    sale_price: o.sale_price,
    confirmation_status: o.confirmation_status,
    delivery_status: o.delivery_status,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("products.tabs.orders")}</h2>
        <Link href={`/app/orders/all?product_id=${id}`} className="inline-flex items-center gap-1 text-xs text-info hover:underline">
          {t("common.viewAll")} <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ProductOrdersTable rows={rows} />
    </div>
  );
}
