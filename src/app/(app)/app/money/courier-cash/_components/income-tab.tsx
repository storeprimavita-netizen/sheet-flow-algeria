import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { asPnl, type PnlLines } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { FinanceFilterBar } from "../../finance-filter-bar";
import { financeQs } from "@/lib/query-string";

type Row = { productId: string; name: string; pnl: PnlLines };

export async function IncomeTab({ from, to }: { from?: string; to?: string }) {

  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  // One money model (00022): per-product lines + workspace totals from the
  // same SQL formula the dashboard uses — net includes COGS, ads, expenses
  // and the fixed-fee share, not just return fees.
  const range = { p_from: from || undefined, p_to: to || undefined };
  const [{ data: pnls }, { data: totalRaw }, { data: products }] = await Promise.all([
    supabase.rpc("pnl_by_product", range),
    supabase.rpc("pnl_summary", range),
    supabase.from("products").select("id, name").eq("workspace_id", profile.workspaceId),
  ]);
  const nameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const rows: Row[] = (pnls ?? [])
    .map((r) => ({ productId: r.product_id, name: nameById.get(r.product_id) ?? "—", pnl: asPnl(r.pnl) }))
    .filter((r): r is Row => !!r.pnl && r.pnl.orders_delivered + r.pnl.orders_returned > 0)
    .sort((a, b) => b.pnl.revenue - a.pnl.revenue);

  const total = asPnl(totalRaw);
  const totalRevenue = total?.revenue ?? 0;
  const totalReturnFees = total?.return_fees ?? 0;
  const totalNet = total?.net_profit ?? 0;

  const qs = (extra: Record<string, string | undefined>) => financeQs({ from, to }, extra);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("finance.subtitleIncome")}</p>
      <FinanceFilterBar products={[]} showProduct={false} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-surface rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("dashboard.kpi.revenue")}</div>
          <div className="num mt-1 text-2xl font-semibold text-success">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="card-surface rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("finance.returnFeeTotal")}</div>
          <div className="num mt-1 text-2xl font-semibold text-danger">{formatCurrency(totalReturnFees)}</div>
        </div>
        <div className="card-surface rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("products.statistics.netProfit")}</div>
          <div className={`num mt-1 text-2xl font-semibold ${totalNet >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(totalNet)}
          </div>
        </div>
      </div>

      <div className="card-surface overflow-hidden rounded-xl">
        <h2 className="p-5 pb-0 text-sm font-semibold">{t("finance.incomeByProduct")}</h2>
        {!rows.length ? (
          <div className="p-5">
            <Empty>{t("finance.noIncomeInRange")}</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto p-5 pt-3">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.product")}</th>
                  <th>{t("products.statistics.delivered")}</th>
                  <th>{t("dashboard.kpi.revenue")}</th>
                  <th>{t("products.statistics.returned")}</th>
                  <th>{t("finance.returnFeeTotal")}</th>
                  <th>{t("products.statistics.netProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const { orders_delivered: delivered, orders_returned: returned, revenue, return_fees: returnFeeTotal, net_profit: net } = r.pnl;
                  return (
                    <tr key={r.productId}>
                      <td>
                        <Link href={`/app/catalog/products/${r.productId}/statistics`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/app/sell/orders${qs({ product_id: r.productId, delivery_status: "delivered" })}`} className="hover:underline">
                          {delivered}
                        </Link>
                      </td>
                      <td className="num">{formatCurrency(revenue)}</td>
                      <td>
                        <Link href={`/app/sell/orders${qs({ product_id: r.productId, delivery_status: "returned" })}`} className="hover:underline">
                          {returned}
                        </Link>
                      </td>
                      <td className="num text-danger">{formatCurrency(returnFeeTotal)}</td>
                      <td className={`num ${net >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
