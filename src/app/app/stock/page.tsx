import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { LOW_STOCK_THRESHOLD, MANUAL_STOCK_REASONS } from "@/lib/enums";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EnumSelect } from "@/components/fields/enum-select";
import { tableClass } from "@/components/field";
import { addStockMovement } from "../products/actions";

export default async function StockHubPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, stock")
    .order("stock", { ascending: true });

  const list = products ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")} subtitle={t("stock.hub.subtitle")} />

      {!list.length ? (
        <Empty>{t("stock.hub.empty")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.product")}</th>
                  <th>SKU</th>
                  <th>{t("stock.onHand")}</th>
                  <th>{t("stock.hub.adjust")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const out = p.stock <= 0;
                  const low = !out && p.stock <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={p.id} className="hover:bg-surface-raised">
                      <td>
                        <Link href={`/app/products/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{p.sku ?? "—"}</td>
                      <td>
                        <Chip token={out ? "danger" : low ? "warning" : "neutral"} size="sm">
                          <span className="num">{p.stock}</span>
                          {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
                        </Chip>
                      </td>
                      <td>
                        <form
                          action={addStockMovement.bind(null, p.id)}
                          className="flex items-center gap-2"
                        >
                          <Input name="delta" type="number" step="1" required className="w-20" />
                          <EnumSelect
                            name="reason"
                            defaultValue="purchase"
                            options={MANUAL_STOCK_REASONS.map((r) => ({
                              value: r,
                              label: t(`stock.reasons.${r}`),
                            }))}
                          />
                          <Input name="note" placeholder={t("stock.note")} className="w-28" />
                          <Button type="submit" size="sm">
                            {t("actions.create")}
                          </Button>
                        </form>
                      </td>
                      <td>
                        <Link
                          href={`/app/products/${p.id}/stock`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          {t("stock.history")}
                        </Link>
                      </td>
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
