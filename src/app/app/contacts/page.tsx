import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeDzPhone } from "@/lib/customers";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tableClass } from "@/components/field";
import { RiskBadge } from "@/components/risk-badge";
import { ContactTabs } from "./tabs";

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
    const [byName, byPhone] = await Promise.all([
      supabase.from("customer_stats").select("*").ilike("name", `%${q}%`),
      supabase.from("customer_stats").select("*").ilike("phone", `%${normalizedPhone}%`),
    ]);
    const byId = new Map([...(byName.data ?? []), ...(byPhone.data ?? [])].map((c) => [c.id, c]));
    customers = [...byId.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  } else {
    const { data } = await supabase.from("customer_stats").select("*").order("name");
    customers = data ?? [];
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.title")} subtitle={t("contacts.subtitle")} />

      <ContactTabs active="customers" />

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder={t("contacts.search")} className="max-w-sm" />
        <Button type="submit">{t("actions.search")}</Button>
      </form>

      {!customers.length ? (
        <Empty>{t("contacts.customersNone")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.phone")}</th>
                  <th>{t("fields.wilaya")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("status.delivery_status.delivered")}</th>
                  <th>{t("status.delivery_status.returned")}</th>
                  <th>{t("fields.risk")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td>
                      <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground">{c.phone}</td>
                    <td className="text-muted-foreground">
                      {c.wilaya_code ? (wilayaName.get(c.wilaya_code) ?? c.wilaya_code) : "—"}
                    </td>
                    <td>{c.total_orders ?? 0}</td>
                    <td>{c.delivered_orders ?? 0}</td>
                    <td>{c.returned_orders ?? 0}</td>
                    <td>
                      <RiskBadge score={c.risk_score ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
