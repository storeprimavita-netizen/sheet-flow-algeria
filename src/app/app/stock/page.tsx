import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { readSettings } from "@/lib/app-settings";
import { PageHeader } from "@/components/page-header";
import { StockManager, type MovementRow, type StockProduct } from "./stock-manager";

const SETTING = "stock_low_threshold";

export default async function StockPage() {
  await requireAdmin("/app/stock");
  const t = await getTranslations();
  const supabase = await createClient();

  const settings = await readSettings(supabase, [SETTING]);
  const threshold = Number(settings[SETTING] ?? 5) || 0;

  const [productsRes, movementsRes] = await Promise.all([
    supabase.from("products").select("id, name, sku, stock, is_active").order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select("id, delta, reason, note, reference, created_at, product:products(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const products: StockProduct[] = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock ?? 0,
    is_active: p.is_active,
  }));

  const movements: MovementRow[] = (movementsRes.data ?? []).map((r: any) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    reference: r.reference,
    created_at: r.created_at,
    product_name: r.product?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")} subtitle={t("stock.subtitle")} />
      <StockManager products={products} movements={movements} threshold={threshold} />
    </div>
  );
}
