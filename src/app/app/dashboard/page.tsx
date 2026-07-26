import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Banknote,
  Package,
  ArrowRight,
  Calculator,
  ShoppingBag,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";

export default async function DashboardPage() {
  const t = await getTranslations();
  const isAdmin = await isCurrentUserAdmin();
  const supabase = await createClient();

  // KPI tiles return with the Phase 7 dashboard RPC (00008_dashboard.sql);
  // until then the dashboard is recent orders + quick links.
  const { data: recent } = await supabase
    .from("orders")
    .select(
      "id,order_number,quantity,sale_price,confirmation_status,delivery_status,created_at,product:products(name),customer:customers(name)",
    )
    .order("created_at", { ascending: false })
    .limit(6);

  const links = [
    { href: "/app/orders", icon: ShoppingBag, label: t("nav.orders") },
    { href: "/app/products", icon: Package, label: t("nav.products") },
    { href: "/app/bi", icon: Banknote, label: t("nav.bi") },
    { href: "/app/expenses", icon: Wallet, label: t("nav.expenses") },
    ...(isAdmin ? [{ href: "/app/pricing", icon: Calculator, label: t("nav.pricing") }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {/* recent orders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("dashboard.recent")}</h2>
          <Link href="/app/orders" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {t("nav.orders")}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
        {!recent?.length ? (
          <Empty>{t("dashboard.noRecent")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.order")}</th>
                    <th>{t("fields.customer")}</th>
                    <th>{t("fields.product")}</th>
                    <th>{t("fields.total_amount")}</th>
                    <th>{t("fields.confirmation_status")}</th>
                    <th>{t("fields.delivery_status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td>
                        <Link href={`/app/orders/${o.id}`} className="font-medium hover:underline">
                          {o.order_number ?? o.id.slice(0, 8)}
                        </Link>
                        <div className="text-[10px] text-muted-foreground">{formatDateTime(o.created_at)}</div>
                      </td>
                      <td className="text-muted-foreground">{o.customer?.name ?? "—"}</td>
                      <td className="text-muted-foreground">{o.product?.name ?? "—"}</td>
                      <td>{formatCurrency((o.sale_price ?? 0) * o.quantity)}</td>
                      <td>
                        <Badge variant={o.confirmation_status === "confirmed" ? "default" : "secondary"}>
                          {t(`status.confirmation_status.${o.confirmation_status}`)}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={o.delivery_status === "delivered" ? "default" : "secondary"}>
                          {t(`status.delivery_status.${o.delivery_status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* quick links */}
      <div className="flex flex-wrap gap-2">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="glass-card flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/30"
          >
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
