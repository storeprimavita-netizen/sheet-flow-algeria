import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, tableClass } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { OrderTabs } from "../order-tabs";
import { recordCashCollection, markDeposited } from "./actions";
import { OrderNo } from "@/components/order-no";

export default async function CashPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: delivered }, { data: collections }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_seq, sale_price, quantity, customer_name")
      .eq("delivery_status", "delivered")
      .order("created_at", { ascending: false }),
    supabase
      .from("cash_collections")
      .select("*, order:orders(order_seq, customer_name)")
      .order("created_at", { ascending: false }),
  ]);

  const collectedOrderIds = new Set((collections ?? []).map((c) => c.order_id));
  const uncollected = (delivered ?? []).filter((o) => !collectedOrderIds.has(o.id));
  const outstanding = (collections ?? []).filter((c) => c.status === "collected");
  const deposits = (collections ?? []).filter((c) => c.status === "deposited");

  return (
    <div className="space-y-6">
      <PageHeader title={t("cash.title")} subtitle={t("cash.subtitle")} />
      <OrderTabs active="cash" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("cash.record")}</h2>
        <p className="text-xs text-muted-foreground">{t("cash.recordHint")}</p>
        {!uncollected.length ? (
          <Empty>{t("cash.noUncollected")}</Empty>
        ) : (
          <div className="space-y-2">
            {uncollected.map((o) => {
              const total = (o.sale_price ?? 0) * o.quantity;
              return (
                <form
                  key={o.id}
                  action={recordCashCollection.bind(null, o.id)}
                  className="card-surface flex flex-wrap items-end gap-3 rounded-xl p-3"
                >
                  <div className="min-w-[12rem] flex-1">
                    <div className="font-medium"><OrderNo seq={o.order_seq} /></div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer_name ?? "—"} · {t("fields.total_amount")}: {formatCurrency(total)}
                    </div>
                  </div>
                  <Field label={t("cash.amount")} htmlFor={`amt_${o.id}`}>
                    <Input
                      id={`amt_${o.id}`}
                      name="amount_dzd"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={total}
                      className="w-32"
                    />
                  </Field>
                  <Button type="submit" size="sm">
                    {t("cash.save")}
                  </Button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("cash.outstanding")}</h2>
        {!outstanding.length ? (
          <Empty>{t("cash.noOutstanding")}</Empty>
        ) : (
          <div className="space-y-2">
            {outstanding.map((c) => (
              <form
                key={c.id}
                action={markDeposited.bind(null, c.id)}
                className="card-surface flex flex-wrap items-end gap-3 rounded-xl p-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <div className="font-medium"><OrderNo seq={c.order?.order_seq} /></div>
                  <div className="text-xs text-muted-foreground">
                    {c.order?.customer_name ?? "—"} · {formatCurrency(c.amount_dzd)} · {formatDate(c.collected_on)}
                  </div>
                </div>
                <Field label={t("cash.depositReference")} htmlFor={`ref_${c.id}`}>
                  <Input id={`ref_${c.id}`} name="reference" className="w-40" />
                </Field>
                <Button type="submit" size="sm">
                  {t("cash.createDeposit")}
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("cash.deposits")}</h2>
        {!deposits.length ? (
          <Empty>{t("cash.noDeposits")}</Empty>
        ) : (
          <div className="card-surface overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("cash.order")}</th>
                    <th>{t("cash.depositReference")}</th>
                    <th>{t("cash.amount")}</th>
                    <th>{t("fields.placed_at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium"><OrderNo seq={d.order?.order_seq} /></td>
                      <td>
                        {d.reference ? <Badge variant="secondary">{d.reference}</Badge> : "—"}
                      </td>
                      <td>{formatCurrency(d.amount_dzd)}</td>
                      <td className="text-muted-foreground">{formatDate(d.deposited_on)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
