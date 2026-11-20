import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeDzPhone } from "@/lib/customers";
import { sortRows } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SearchParamInput } from "@/components/fields/search-param-input";
import { CustomersTable, type CustomerRow, type CustomerOrder } from "./customers-table";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: wilayas } = await supabase.from("wilayas").select("code, name").order("code");
  const wilayaName = new Map((wilayas ?? []).map((w) => [w.code, w.name]));

  let customers;
  if (q) {
    const normalizedPhone = normalizeDzPhone(q);
    // A name like "Riad" normalizes to "" → ilike '%%' matched every customer;
    // only search phones when the query actually has digits.
    const [byName, byPhone] = await Promise.all([
      supabase.from("customer_stats").select("*").ilike("name", `%${q}%`),
      normalizedPhone
        ? supabase.from("customer_stats").select("*").ilike("phone", `%${normalizedPhone}%`)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const byId = new Map([...(byName.data ?? []), ...(byPhone.data ?? [])].map((c) => [c.id, c]));
    customers = [...byId.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  } else {
    const { data } = await supabase.from("customer_stats").select("*").order("name");
    customers = data ?? [];
  }

  const customerIds = customers.map((c) => c.id);
  const { data: orders } = customerIds.length
    ? await supabase
        .from("orders")
        .select(
          "id, customer_id, order_seq, quantity, sale_price, confirmation_status, delivery_status, placed_at, product:products(name)",
        )
        .in("customer_id", customerIds)
        .order("placed_at", { ascending: false })
    : { data: [] };

  const ordersByCustomer = new Map<string, CustomerOrder[]>();
  const lastOrderAt = new Map<string, string | null>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const list = ordersByCustomer.get(o.customer_id) ?? [];
    list.push({
      id: o.id,
      order_seq: o.order_seq,
      product_name: o.product?.name ?? null,
      quantity: o.quantity,
      sale_price: o.sale_price,
      confirmation_status: o.confirmation_status,
      delivery_status: o.delivery_status,
      placed_at: o.placed_at,
    });
    ordersByCustomer.set(o.customer_id, list);
    if (!lastOrderAt.has(o.customer_id)) lastOrderAt.set(o.customer_id, o.placed_at);
  }

  const rows: CustomerRow[] = sortRows(
    customers
      .filter((c): c is typeof c & { id: string } => Boolean(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name ?? "—",
        phone: c.phone ?? "—",
        wilaya_name: c.wilaya_code ? (wilayaName.get(c.wilaya_code) ?? String(c.wilaya_code)) : null,
        commune: c.commune,
        total_orders: c.total_orders ?? 0,
        delivered_orders: c.delivered_orders ?? 0,
        returned_orders: c.returned_orders ?? 0,
        cancelled_orders: c.cancelled_orders ?? 0,
        no_answer_orders: c.no_answer_orders ?? 0,
        risk_score: c.risk_score ?? 0,
        last_order_at: lastOrderAt.get(c.id) ?? null,
        orders: ordersByCustomer.get(c.id) ?? [],
      })),
    {
      name: (r) => r.name.toLowerCase(),
      total_orders: (r) => r.total_orders,
      risk: (r) => r.risk_score,
      last_order: (r) => r.last_order_at ?? "",
    },
    typeof sp.sort === "string" ? sp.sort : null,
    sp.dir === "desc" ? "desc" : "asc",
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.customers")} subtitle={t("navPurpose.customers")} />

      <SearchParamInput placeholder={t("contacts.search")} />

      <CustomersTable rows={rows} />
    </div>
  );
}
