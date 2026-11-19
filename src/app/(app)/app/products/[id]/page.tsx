import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Gem, Megaphone, PackageCheck, Boxes, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/format";
import { asPnl, pnlMetrics } from "@/lib/pricing";
import { asKpi, kpiPct, kpiRoas } from "@/lib/kpi";
import { DeleteButton } from "@/components/delete-button";
import { KpiTile } from "@/components/stats/kpi-tile";
import { ProductForm } from "../product-form";
import { VariantsEditor } from "../_components/variants-editor";
import { StatusPill } from "@/components/status-pill";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { loadProductVariants } from "@/lib/catalog/variants-data";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: product }, { data: cost }, { data: pnlRaw }, { data: kpiRaw }, variantMap, { data: sizeStock }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("*").eq("product_id", id).maybeSingle(),
    supabase.rpc("pnl_summary", { p_product: id }),
    supabase.rpc("kpi_summary", { p_product: id }),
    loadProductVariants(supabase, [id]),
    supabase.from("product_variant_stock_v").select("count_needed").eq("product_id", id).maybeSingle(),
  ]);

  if (!product) notFound();
  // size sets are admin-only (RLS); anyone else gets null and the button is hidden
  const sizeSets = (await isCurrentUserAdmin())
    ? ((await supabase.from("size_sets").select("id, name, items").order("position").order("name")).data ?? [])
    : null;

  // Read-mode overview (all-time, one money model) above the edit form.
  const pnl = asPnl(pnlRaw);
  const m = pnl ? pnlMetrics(pnl) : null;
  const kpi = asKpi(kpiRaw);
  const roas = kpiRoas(kpi);
  const delivRate = kpiPct(kpi?.delivery);
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
          <KpiTile icon={Megaphone} label={t("dashboard.kpi2.roas")} value={roas != null ? `${roas.toFixed(2)}×` : "—"} hint={t("dashboard.hint.roas")} href={`${base}/expenses`} />
          <KpiTile
            icon={PackageCheck}
            label={t("dashboard.kpi.deliveryRate")}
            value={delivRate != null ? `${delivRate}%` : "—"}
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
      {sizeStock?.count_needed ? (
        <Link href={`${base}/stock`} className="inline-flex items-center gap-2 text-sm hover:underline">
          <StatusPill kind="stock" status="count_needed" />
        </Link>
      ) : null}
      <ProductForm product={product} cost={cost} />
      <VariantsEditor
        productId={product.id}
        productCode={product.sku || product.name}
        sizeSets={sizeSets}
        initialOptions={variantMap.get(id)?.options ?? []}
        initialVariants={(variantMap.get(id)?.variants ?? []).map((v) => ({
          id: v.id,
          sku: v.sku,
          isActive: v.isActive,
          stock: v.stock,
          values: v.values,
        }))}
      />
      <div className="flex justify-end border-t border-border pt-4">
        <DeleteButton table="products" id={product.id} redirectTo="/app/products" />
      </div>
    </div>
  );
}
