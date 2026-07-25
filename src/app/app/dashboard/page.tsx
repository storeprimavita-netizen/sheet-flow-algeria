import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CheckCircle2,
  Truck,
  Undo2,
  Banknote,
  ClipboardList,
  PackageCheck,
  Package,
  Users,
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

type Kpis = {
  today: { confirmed: number; delivered: number; returned: number; revenue: number };
  month: { confirmed: number; delivered: number; returned: number; revenue: number };
  queue: { pending_confirmation: number; awaiting_delivery: number };
  top_product: { name: string; delivered: number } | null;
  totals: { products: number; orders: number; customers: number };
};

const ZERO: Kpis = {
  today: { confirmed: 0, delivered: 0, returned: 0, revenue: 0 },
  month: { confirmed: 0, delivered: 0, returned: 0, revenue: 0 },
  queue: { pending_confirmation: 0, awaiting_delivery: 0 },
  top_product: null,
  totals: { products: 0, orders: 0, customers: 0 },
};

export default async function DashboardPage() {
  const t = await getTranslations();
  const isAdmin = await isCurrentUserAdmin();
  const supabase = await createClient();

  const [{ data: kRaw }, { data: recent }] = await Promise.all([
    supabase.rpc("dashboard_kpis"),
    supabase
      .from("orders")
      .select(
        "id,order_number,total_amount,confirmation_status,delivery_status,created_at,product:products(name),customer:contacts(name)",
      )
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const k = (kRaw as Kpis | null) ?? ZERO;

  const kpis = [
    { key: "confirmed", icon: CheckCircle2, month: k.month.confirmed, today: k.today.confirmed, accent: false },
    { key: "delivered", icon: Truck, month: k.month.delivered, today: k.today.delivered, accent: false },
    { key: "returned", icon: Undo2, month: k.month.returned, today: k.today.returned, accent: false },
    {
      key: "revenue",
      icon: Banknote,
      month: formatCurrency(k.month.revenue),
      today: formatCurrency(k.today.revenue),
      accent: true,
    },
  ] as const;

  const queue = [
    { key: "pendingConfirmation", icon: ClipboardList, value: k.queue.pending_confirmation, href: "/app/orders" },
    { key: "awaitingDelivery", icon: PackageCheck, value: k.queue.awaiting_delivery, href: "/app/orders" },
    { key: "products", icon: Package, value: k.totals.products, href: "/app/products" },
    { key: "customers", icon: Users, value: k.totals.customers, href: "/app/contacts" },
  ] as const;

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

      {/* KPIs: month value big, today small */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ key, icon: Icon, month, today, accent }) => (
          <div key={key} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`dashboard.kpi.${key}`)}
              </span>
              <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold ${accent ? "text-gradient" : ""}`}>{month}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t("dashboard.kpi.today")}: <span className="font-medium text-foreground">{today}</span>
            </div>
          </div>
        ))}
      </div>

      {/* queue + totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {queue.map(({ key, icon: Icon, value, href }) => (
          <Link key={key} href={href} className="glass-card rounded-xl p-4 transition-colors hover:bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t(`dashboard.queue.${key}`)}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
          </Link>
        ))}
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
                      <td>{formatCurrency(o.total_amount)}</td>
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
