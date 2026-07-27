import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUSES } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { setProductStatus } from "./actions";

export default async function ProductsPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, product_costs(sourcing_cost_dzd)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.title")} subtitle={t("products.subtitle")}>
        <ButtonLink href="/app/products/new">
          <Plus />
          {t("products.new")}
        </ButtonLink>
      </PageHeader>

      {!products?.length ? (
        <Empty>{t("products.none")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th />
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.category")}</th>
                  <th>{t("fields.price")}</th>
                  <th>{t("stock.stock")}</th>
                  <th>{t("products.costTotal")}</th>
                  <th>{t("fields.status")}</th>
                  <th>{t("fields.placed_at")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const out = p.stock <= 0;
                  const low = !out && p.stock <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td>
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external supplier URLs, no next/image domain config this phase
                          <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted" />
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/app/products/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{p.sku ?? "—"}</div>
                      </td>
                      <td className="text-muted-foreground">{p.category ?? "—"}</td>
                      <td>{formatCurrency(p.sale_price)}</td>
                      <td>
                        <Badge variant={out ? "destructive" : low ? "secondary" : "outline"}>
                          {p.stock}
                          {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
                        </Badge>
                      </td>
                      <td>{formatCurrency(p.product_costs?.sourcing_cost_dzd)}</td>
                      <td>
                        <form action={setProductStatus.bind(null, p.id)} className="flex items-center gap-1">
                          <Select name="status" defaultValue={p.status} className="h-7 py-0 text-xs">
                            {PRODUCT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {t(`status.product_status.${s}`)}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" size="sm" variant="ghost">
                            {t("actions.save")}
                          </Button>
                        </form>
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
