import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar, financeQs } from "../finance-filter-bar";

type Row = { productId: string; name: string; delivered: number; revenue: number; returned: number };

export default async function FinanceIncomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { from, to } = sp;

  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("product_id, sale_price, quantity, delivery_status, product:products(name)")
    .eq("workspace_id", profile.workspaceId)
    .in("delivery_status", ["delivered", "returned"]);
  if (from) query = query.gte("placed_at", from);
  if (to) query = query.lte("placed_at", `${to}T23:59:59`);

  const [{ data: orders }, returnFee] = await Promise.all([
    query,
    getSetting(profile.workspaceId, "return_fee"),
  ]);

  const byProduct = new Map<string, Row>();
  for (const o of orders ?? []) {
    if (!o.product_id) continue;
    const row = byProduct.get(o.product_id) ?? { productId: o.product_id, name: o.product?.name ?? "—", delivered: 0, revenue: 0, returned: 0 };
    if (o.delivery_status === "delivered") {
      row.delivered += 1;
      row.revenue += (o.sale_price ?? 0) * o.quantity;
    } else if (o.delivery_status === "returned") {
      row.returned += 1;
    }
    byProduct.set(o.product_id, row);
  }
  const rows = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalReturnFees = rows.reduce((s, r) => s + r.returned * returnFee.amount, 0);
  const totalNet = totalRevenue - totalReturnFees;

  const qs = (extra: Record<string, string | undefined>) => financeQs({ from, to }, extra);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.income")} subtitle={t("finance.subtitleIncome")} />
      <FinanceTabs active="income" />
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
                  const returnFeeTotal = r.returned * returnFee.amount;
                  const net = r.revenue - returnFeeTotal;
                  return (
                    <tr key={r.productId}>
                      <td>
                        <Link href={`/app/products/${r.productId}/statistics`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/app/orders/all${qs({ product_id: r.productId, delivery_status: "delivered" })}`} className="hover:underline">
                          {r.delivered}
                        </Link>
                      </td>
                      <td className="num">{formatCurrency(r.revenue)}</td>
                      <td>
                        <Link href={`/app/orders/all${qs({ product_id: r.productId, delivery_status: "returned" })}`} className="hover:underline">
                          {r.returned}
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
