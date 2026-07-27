import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, isCurrentUserAdmin } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, tableClass } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { RiskBadge } from "@/components/risk-badge";
import { saveCustomer } from "../actions";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;
  const isAdmin = await isCurrentUserAdmin();

  const supabase = await createClient();
  const [{ data: customer }, { data: stat }, { data: wilayas }, { data: orders }, weights] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("customer_stats").select("*").eq("id", id).maybeSingle(),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase
      .from("orders")
      .select("id, order_number, quantity, sale_price, confirmation_status, delivery_status, placed_at, product:products(name)")
      .eq("customer_id", id)
      .order("placed_at", { ascending: false }),
    getSetting(profile.workspaceId, "risk_weights"),
  ]);

  if (!customer) notFound();

  const wilayaName = new Map((wilayas ?? []).map((w) => [w.code, w.name]));
  const total = stat?.total_orders ?? 0;
  const returned = stat?.returned_orders ?? 0;
  const cancelled = stat?.cancelled_orders ?? 0;
  const noAnswer = stat?.no_answer_orders ?? 0;
  const points = weights.returned * returned + weights.cancelled * cancelled + weights.no_answer * noAnswer;

  return (
    <div className="space-y-6">
      <PageHeader title={customer.name} subtitle={customer.phone}>
        <RiskBadge score={stat?.risk_score ?? 0} />
      </PageHeader>

      {isAdmin ? (
        <form action={saveCustomer.bind(null, id)} className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
          <Field label={t("fields.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={customer.name} />
          </Field>
          <Field label={t("fields.wilaya")} htmlFor="wilaya_code">
            <Select id="wilaya_code" name="wilaya_code" defaultValue={customer.wilaya_code ?? ""}>
              <option value="">{t("fields.none")}</option>
              {(wilayas ?? []).map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.city")} htmlFor="commune" hint={t("common.optional")}>
            <Input id="commune" name="commune" defaultValue={customer.commune ?? ""} />
          </Field>
          <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
            <Textarea id="notes" name="notes" defaultValue={customer.notes ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">{t("actions.save")}</Button>
          </div>
        </form>
      ) : (
        <div className="card-surface grid grid-cols-2 gap-4 rounded-xl p-5 sm:grid-cols-3">
          <Meta label={t("fields.wilaya")}>
            {customer.wilaya_code ? (wilayaName.get(customer.wilaya_code) ?? customer.wilaya_code) : "—"}
          </Meta>
          <Meta label={t("fields.city")}>{customer.commune ?? "—"}</Meta>
          <Meta label={t("fields.notes")}>{customer.notes ?? "—"}</Meta>
        </div>
      )}

      <section className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("contacts.riskBreakdown")}</h2>
        <p className="text-xs text-muted-foreground">{t("contacts.riskFormulaHint")}</p>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{t("fields.type")}</th>
              <th>{t("common.total")}</th>
              <th>{t("fields.weight")}</th>
              <th>{t("contacts.points")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t("status.delivery_status.returned")}</td>
              <td>{returned}</td>
              <td>{weights.returned}</td>
              <td>{weights.returned * returned}</td>
            </tr>
            <tr>
              <td>{t("status.confirmation_status.cancelled")}</td>
              <td>{cancelled}</td>
              <td>{weights.cancelled}</td>
              <td>{weights.cancelled * cancelled}</td>
            </tr>
            <tr>
              <td>{t("status.confirmation_status.no_answer")}</td>
              <td>{noAnswer}</td>
              <td>{weights.no_answer}</td>
              <td>{weights.no_answer * noAnswer}</td>
            </tr>
          </tbody>
        </table>
        <div className="text-sm text-muted-foreground">
          {t("common.total")}: {total} · {t("fields.risk")} = min(100, round(100 × {points} ÷ ({weights.returned} × {total}))) ={" "}
          <Badge variant="outline">{stat?.risk_score ?? 0}</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("contacts.orderHistory")}</h2>
        {!orders?.length ? (
          <Empty>{t("contacts.noOrders")}</Empty>
        ) : (
          <div className="card-surface overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("orders.title")}</th>
                    <th>{t("fields.product")}</th>
                    <th>{t("fields.total_amount")}</th>
                    <th>{t("fields.confirmation_status")}</th>
                    <th>{t("fields.delivery_status")}</th>
                    <th>{t("fields.placed_at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td>
                        <Link href={`/app/orders/${o.id}`} className="font-medium hover:underline">
                          {o.order_number ?? o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{o.product?.name ?? "—"}</td>
                      <td>{formatCurrency((o.sale_price ?? 0) * o.quantity)}</td>
                      <td>
                        <Badge variant={o.confirmation_status === "confirmed" ? "default" : "secondary"}>
                          {t(`status.confirmation_status.${o.confirmation_status}`)}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          variant={
                            o.delivery_status === "delivered"
                              ? "default"
                              : o.delivery_status === "returned" || o.delivery_status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {t(`status.delivery_status.${o.delivery_status}`)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground">{formatDate(o.placed_at)}</td>
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
