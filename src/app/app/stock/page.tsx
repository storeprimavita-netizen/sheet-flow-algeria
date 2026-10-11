import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Boxes, Gem, PackageMinus, PackageX } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Chip } from "@/components/ui/chip";
import { KpiTile } from "@/components/stats/kpi-tile";
import { tableClass } from "@/components/field";
import { StockAdjustDialog, ThresholdInput } from "./stock-controls";

export default async function StockHubPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  // Admin-only route (layout guard); product_costs is admin-only by RLS.
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, stock, low_stock_threshold, cost:product_costs(sourcing_cost_dzd)")
    .neq("status", "cancelled")
    .order("stock", { ascending: true });

  const list = (products ?? []).map((p) => {
    const unitCost = p.cost?.sourcing_cost_dzd ?? null;
    return { ...p, unitCost, value: unitCost != null ? Math.max(p.stock, 0) * unitCost : null };
  });
  const units = list.reduce((n, p) => n + Math.max(p.stock, 0), 0);
  const value = list.reduce((n, p) => n + (p.value ?? 0), 0);
  const out = list.filter((p) => p.stock <= 0).length;
  const low = list.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")} subtitle={t("stock.hub.subtitle")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={Boxes} label={t("stock.unitsOnHand")} value={units.toLocaleString("en-US").replace(/,/g, " ")} />
        <KpiTile icon={Gem} label={t("stock.stockValue")} value={formatCurrency(value)} hint={t("stock.stockValueHint")} />
        <KpiTile icon={PackageMinus} label={t("stock.lowCount")} value={String(low)} tone={low ? "danger" : undefined} />
        <KpiTile icon={PackageX} label={t("stock.outCount")} value={String(out)} tone={out ? "danger" : undefined} />
      </div>

      {!list.length ? (
        <Empty>{t("stock.hub.empty")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.product")}</th>
                  <th>SKU</th>
                  <th>{t("stock.onHand")}</th>
                  <th>{t("stock.threshold")}</th>
                  <th className="!text-end">{t("stock.unitCost")}</th>
                  <th className="!text-end">{t("stock.stockValue")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const isOut = p.stock <= 0;
                  const isLow = !isOut && p.stock <= p.low_stock_threshold;
                  return (
                    <tr key={p.id} className="hover:bg-surface-raised">
                      <td>
                        <Link href={`/app/products/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{p.sku ?? "—"}</td>
                      <td>
                        <Chip token={isOut ? "danger" : isLow ? "warning" : "neutral"} size="sm">
                          <span className="num">{p.stock}</span>
                          {isOut ? ` · ${t("stock.out")}` : isLow ? ` · ${t("stock.low")}` : ""}
                        </Chip>
                      </td>
                      <td>
                        <ThresholdInput productId={p.id} value={p.low_stock_threshold} label={t("stock.threshold")} />
                      </td>
                      <td className="num whitespace-nowrap text-end text-muted-foreground">{formatCurrency(p.unitCost)}</td>
                      <td className="num whitespace-nowrap text-end">{formatCurrency(p.value)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-3">
                          <StockAdjustDialog productId={p.id} name={p.name} />
                          <Link href={`/app/products/${p.id}/stock`} className="whitespace-nowrap text-xs text-muted-foreground hover:underline">
                            {t("stock.history")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
