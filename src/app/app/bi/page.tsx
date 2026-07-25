import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { PriceCalculator } from "./price-calculator";

const COST_KEYS = [
  "cost_shooting",
  "cost_packaging",
  "cost_sampling",
  "cost_confirmation",
  "cost_delivery",
  "cost_test_ads",
  "cost_scaling_ads",
] as const;

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-gradient" : ""}`}>{value}</div>
    </div>
  );
}

export default async function BiPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: orders }, { data: products }, { data: customers }] = await Promise.all([
    supabase
      .from("orders")
      .select("total_amount, confirmation_status, delivery_status"),
    supabase
      .from("products")
      .select("selling_price, is_active, status, cost_shooting, cost_packaging, cost_sampling, cost_confirmation, cost_delivery, cost_test_ads, cost_scaling_ads"),
    supabase
      .from("customer_profiles")
      .select("*")
      .order("delivered_orders", { ascending: false })
      .limit(10),
  ]);

  const list = orders ?? [];
  const revenue = list
    .filter((o) => o.delivery_status === "delivered")
    .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const confirmed = list.filter((o) => o.confirmation_status === "confirmed").length;
  const delivered = list.filter((o) => o.delivery_status === "delivered").length;
  const returned = list.filter((o) => o.delivery_status === "returned").length;
  const pending = list.filter((o) => o.confirmation_status === "wait_for_confirmation").length;

  const margins = (products ?? [])
    .filter((p) => p.is_active && p.selling_price !== null)
    .map((p) => Number(p.selling_price) - COST_KEYS.reduce((s, k) => s + Number(p[k] ?? 0), 0));
  const avgMargin = margins.length
    ? margins.reduce((s, m) => s + m, 0) / margins.length
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("bi.title")} subtitle={t("bi.subtitle")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("bi.revenue")} value={formatCurrency(revenue)} accent />
        <Stat label={t("bi.confirmed")} value={String(confirmed)} />
        <Stat label={t("bi.pending")} value={String(pending)} />
        <Stat label={t("bi.deliveryRate")} value={pct(delivered, confirmed)} />
        <Stat label={t("bi.returnRate")} value={pct(returned, confirmed)} />
        <Stat
          label={t("bi.avgMargin")}
          value={avgMargin === null ? "—" : formatCurrency(avgMargin)}
        />
      </div>

      <PriceCalculator />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("bi.customers")}</h2>
        {!customers?.length ? (
          <Empty>{t("common.empty")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.name")}</th>
                    <th>{t("fields.city")}</th>
                    <th>{t("bi.orders")}</th>
                    <th>{t("bi.confirmed")}</th>
                    <th>{t("bi.delivered")}</th>
                    <th>{t("bi.reliability")}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-muted-foreground">{c.city ?? "—"}</td>
                      <td>{c.total_orders}</td>
                      <td>{c.confirmed_orders}</td>
                      <td>{c.delivered_orders}</td>
                      <td>
                        {c.reliability_score === null
                          ? "—"
                          : pct(Number(c.reliability_score), 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
