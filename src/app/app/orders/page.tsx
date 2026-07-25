import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";

export default async function OrdersPage() {
  const t = await getTranslations();
  const isAdmin = await isCurrentUserAdmin();
  const supabase = await createClient();

  // RLS scopes this automatically: confirmation agents see only unconfirmed,
  // delivery agents only confirmed, admins everything.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, quantity, total_amount, confirmation_status, delivery_status, city, placed_at, product:products(name), customer:contacts(name)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        {isAdmin ? (
          <ButtonLink href="/app/orders/new">
            <Plus />
            {t("orders.new")}
          </ButtonLink>
        ) : null}
      </PageHeader>

      {!orders?.length ? (
        <Empty>{t("orders.none")}</Empty>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
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
                      <Link
                        href={`/app/orders/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        {o.order_number ?? o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-muted-foreground">{o.product?.name ?? "—"}</td>
                    <td className="text-muted-foreground">{o.customer?.name ?? "—"}</td>
                    <td>{formatCurrency(o.total_amount)}</td>
                    <td>
                      <Badge
                        variant={o.confirmation_status === "confirmed" ? "default" : "secondary"}
                      >
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
    </div>
  );
}
