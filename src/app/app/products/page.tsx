import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { netProfit } from "@/lib/product-metrics";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ProductsView, type ProductRow } from "./products-view";

const SPARK_DAYS = 30;

export default async function ProductsPage() {
  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const since = new Date(Date.now() - SPARK_DAYS * 86400000);
  const sinceISO = since.toISOString().slice(0, 10);

  const [{ data: products }, { data: stats }, { data: fees }, { data: recentOrders }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, category, status, sale_price, stock, images, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("product_stats").select("*").eq("workspace_id", profile.workspaceId),
    supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", profile.workspaceId).eq("is_active", true),
    supabase.from("orders").select("product_id, placed_at").gte("placed_at", since.toISOString()),
  ]);

  const statById = new Map((stats ?? []).map((s) => [s.id, s]));
  const fixedFeesTotal = (fees ?? []).reduce((sum, f) => sum + (f.amount_dzd ?? 0), 0);
  const totalDelivered = (stats ?? []).reduce((sum, s) => sum + (s.orders_delivered ?? 0), 0);

  // per-product daily order counts over the last 30 days (sparkline)
  const sparks = new Map<string, number[]>();
  const dayIndex = (iso: string) =>
    Math.floor((new Date(iso).getTime() - since.getTime()) / 86400000);
  for (const o of recentOrders ?? []) {
    if (!o.product_id || !o.placed_at) continue;
    let arr = sparks.get(o.product_id);
    if (!arr) sparks.set(o.product_id, (arr = new Array(SPARK_DAYS).fill(0)));
    const i = dayIndex(o.placed_at);
    if (i >= 0 && i < SPARK_DAYS) arr[i] += 1;
  }

  const rows: ProductRow[] = (products ?? []).map((p) => {
    const s = statById.get(p.id);
    const { net } = s
      ? netProfit(s, fixedFeesTotal, totalDelivered)
      : { net: null as number | null };
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      image: p.images?.[0] ?? null,
      status: p.status,
      sale_price: p.sale_price,
      stock: p.stock,
      delivery_rate: s?.delivery_rate ?? null,
      net_profit: s && (s.orders_delivered ?? 0) > 0 ? net : null,
      created_at: p.created_at,
      spark: sparks.get(p.id) ?? new Array(SPARK_DAYS).fill(0),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.title")} subtitle={t("products.subtitle")}>
        <ButtonLink href="/app/products/new">
          <Plus />
          {t("products.new")}
        </ButtonLink>
      </PageHeader>

      <ProductsView rows={rows} />
    </div>
  );
}
