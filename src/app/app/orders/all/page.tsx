import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, tableClass } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { CONFIRMATION_STATUSES, DELIVERY_STATUSES, ORDER_SOURCES } from "@/lib/enums";
import { OrderTabs } from "../order-tabs";

const PAGE_SIZE = 25;

export default async function AllOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? sp[k] : "");
  const page = Math.max(1, Number(get("page")) || 1);

  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: products }, { data: wilayas }, { data: agents }] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("profiles").select("user_id, display_name, role").eq("is_active", true),
  ]);
  const agentOpts = (agents ?? []).filter((a) => a.role !== "admin");

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, quantity, sale_price, confirmation_status, delivery_status, source, placed_at, product:products(name), customer:customers(name, phone)",
      { count: "exact" },
    );

  if (get("confirmation_status"))
    query = query.eq("confirmation_status", get("confirmation_status") as Enums<"confirmation_status">);
  if (get("delivery_status"))
    query = query.eq("delivery_status", get("delivery_status") as Enums<"delivery_status">);
  if (get("product_id")) query = query.eq("product_id", get("product_id"));
  if (get("wilaya_code")) query = query.eq("wilaya_code", Number(get("wilaya_code")));
  if (get("source")) query = query.eq("source", get("source") as Enums<"order_source">);
  // .or() takes a raw PostgREST filter string — validate the shape before
  // interpolating a URL param into it.
  const agentId = /^[0-9a-f-]{36}$/i.test(get("agent")) ? get("agent") : "";
  if (agentId)
    query = query.or(`assigned_confirmation_agent.eq.${agentId},assigned_delivery_agent.eq.${agentId}`);
  if (get("from")) query = query.gte("placed_at", get("from"));
  if (get("to")) query = query.lte("placed_at", `${get("to")}T23:59:59`);

  const from = (page - 1) * PAGE_SIZE;
  const { data: orders, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    for (const k of [
      "confirmation_status",
      "delivery_status",
      "product_id",
      "wilaya_code",
      "source",
      "agent",
      "from",
      "to",
    ]) {
      if (get(k)) params.set(k, get(k));
    }
    for (const [k, v] of Object.entries(overrides)) params.set(k, String(v));
    return `?${params.toString()}`;
  };

  const total = count ?? 0;
  const hasNext = from + PAGE_SIZE < total;

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        <ButtonLink href="/app/orders/new">{t("orders.new")}</ButtonLink>
      </PageHeader>

      <OrderTabs active="all" />

      <form method="get" className="card-surface grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-4 lg:grid-cols-8">
        <Field label={t("fields.confirmation_status")} className="col-span-1">
          <Select name="confirmation_status" defaultValue={get("confirmation_status")}>
            <option value="">{t("common.all")}</option>
            {CONFIRMATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.confirmation_status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.delivery_status")}>
          <Select name="delivery_status" defaultValue={get("delivery_status")}>
            <option value="">{t("common.all")}</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.delivery_status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.product")}>
          <Select name="product_id" defaultValue={get("product_id")}>
            <option value="">{t("common.all")}</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.wilaya")}>
          <Select name="wilaya_code" defaultValue={get("wilaya_code")}>
            <option value="">{t("common.all")}</option>
            {(wilayas ?? []).map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.source")}>
          <Select name="source" defaultValue={get("source")}>
            <option value="">{t("common.all")}</option>
            {ORDER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`status.order_source.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.agent")}>
          <Select name="agent" defaultValue={get("agent")}>
            <option value="">{t("common.all")}</option>
            {agentOpts.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.display_name ?? a.user_id.slice(0, 8)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.from")}>
          <Input type="date" name="from" defaultValue={get("from")} />
        </Field>
        <Field label={t("fields.to")}>
          <Input type="date" name="to" defaultValue={get("to")} />
        </Field>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-8">
          <Button type="submit">{t("actions.search")}</Button>
          <ButtonLink href="/app/orders/all" variant="ghost">
            {t("actions.cancel")}
          </ButtonLink>
        </div>
      </form>

      {!orders?.length ? (
        <Empty>{t("orders.none")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("orders.title")}</th>
                  <th>{t("fields.product")}</th>
                  <th>{t("fields.customer")}</th>
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
                    <td className="text-muted-foreground">{o.customer?.name ?? "—"}</td>
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
          <div className="flex items-center justify-between border-t border-border p-3 text-sm text-muted-foreground">
            <span>
              {t("common.total")}: {total}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <ButtonLink href={qs({ page: page - 1 })} variant="outline" size="sm">
                  {t("common.prev")}
                </ButtonLink>
              ) : null}
              {hasNext ? (
                <ButtonLink href={qs({ page: page + 1 })} variant="outline" size="sm">
                  {t("common.next")}
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
