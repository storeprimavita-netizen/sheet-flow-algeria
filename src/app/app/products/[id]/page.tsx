import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Gem, Megaphone, PackageCheck, Boxes, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/format";
import { asPnl, pnlMetrics } from "@/lib/pricing";
import { DeleteButton } from "@/components/delete-button";
import { KpiTile } from "@/components/stats/kpi-tile";
import { ProductForm } from "../product-form";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: product }, { data: cost }, { data: pnlRaw }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("*").eq("product_id", id).maybeSingle(),
    supabase.rpc("pnl_summary", { p_product: id }),
  ]);

  if (!product) notFound();

  // Read-mode overview (all-time, one money model) above the edit form.
  const pnl = asPnl(pnlRaw);
  const m = pnl ? pnlMetrics(pnl) : null;
  const unitCost = cost?.sourcing_cost_dzd ?? null;
  const lowStock = product.stock <= product.low_stock_threshold;
  const base = `/app/products/${id}`;

  return (
    <div className="space-y-6">
      {pnl ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile
            icon={Wallet}
            label={t("dashboard.kpi.netProfit")}
            value={formatCurrency(pnl.net_profit)}
            tone={pnl.net_profit >= 0 ? "success" : "danger"}
            sub={m?.margin_pct != null ? t("dashboard.kpi2.margin", { pct: formatPercent(m.margin_pct) }) : null}
            hint={t("dashboard.hint.netProfit")}
            href={`${base}/statistics`}
          />
          <KpiTile icon={Megaphone} label={t("dashboard.kpi2.roas")} value={m?.roas != null ? `${m.roas.toFixed(2)}×` : "—"} hint={t("dashboard.hint.roas")} href={`${base}/expenses`} />
          <KpiTile
            icon={PackageCheck}
            label={t("dashboard.kpi.deliveryRate")}
            value={m?.delivery_rate != null ? `${m.delivery_rate}%` : "—"}
            sub={
              m?.breakeven_delivery_pct != null
                ? m.breakeven_delivery_pct > 100
                  ? t("dashboard.kpi2.breakEvenUnreachable")
                  : t("dashboard.kpi2.breakEven", { pct: formatPercent(m.breakeven_delivery_pct) })
                : null
            }
            hint={t("dashboard.hint.deliveryRate")}
            href={`${base}/orders`}
          />
          <KpiTile
            icon={Boxes}
            label={t("stock.onHand")}
            value={String(product.stock)}
            tone={lowStock ? "danger" : undefined}
            sub={`${t("stock.threshold")} ${product.low_stock_threshold}`}
            href={`${base}/stock`}
          />
          <KpiTile
            icon={Gem}
            label={t("stock.stockValue")}
            value={formatCurrency(unitCost != null ? Math.max(product.stock, 0) * unitCost : null)}
            hint={t("stock.stockValueHint")}
            href="/app/stock"
          />
        </div>
      ) : null}
      <ProductForm product={product} cost={cost} />
      <div className="flex justify-end border-t border-border pt-4">
        <DeleteButton table="products" id={product.id} redirectTo="/app/products" />
      </div>
    </div>
  );
}
