import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { readSettings } from "@/lib/app-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";

const COST_KEYS = [
  "cost_shooting",
  "cost_packaging",
  "cost_sampling",
  "cost_confirmation",
  "cost_delivery",
  "cost_test_ads",
  "cost_scaling_ads",
] as const;

export default async function ProductsPage() {
  const t = await getTranslations();
  const isAdmin = await isCurrentUserAdmin();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const settings = await readSettings(supabase, ["stock_low_threshold"]);
  const threshold = Number(settings.stock_low_threshold ?? 5) || 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.title")} subtitle={t("products.subtitle")}>
        {isAdmin ? (
          <ButtonLink href="/app/products/new">
            <Plus />
            {t("products.new")}
          </ButtonLink>
        ) : null}
      </PageHeader>

      {!products?.length ? (
        <Empty>{t("products.none")}</Empty>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.sku")}</th>
                  <th>{t("fields.category")}</th>
                  <th>{t("products.costTotal")}</th>
                  <th>{t("fields.price")}</th>
                  <th>{t("stock.stock")}</th>
                  <th>{t("fields.status")}</th>
                  <th>{t("fields.placed_at")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cost = COST_KEYS.reduce((sum, k) => sum + Number(p[k] ?? 0), 0);
                  const out = p.stock <= 0;
                  const low = !out && p.stock <= threshold;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td>
                        <Link
                          href={`/app/products/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{p.sku ?? "—"}</td>
                      <td className="text-muted-foreground">{p.category ?? "—"}</td>
                      <td>{formatCurrency(cost)}</td>
                      <td>{formatCurrency(p.selling_price)}</td>
                      <td>
                        <Badge variant={out ? "destructive" : low ? "secondary" : "outline"}>
                          {p.stock}
                          {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          variant={
                            p.status === "confirmed"
                              ? "default"
                              : p.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {t(`status.product_status.${p.status}`)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground">{formatDate(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
