import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, MANUAL_STOCK_REASONS } from "@/lib/enums";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { addStockMovement } from "../../actions";

export default async function ProductStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: product }, { data: movements }] = await Promise.all([
    supabase.from("products").select("stock").eq("id", id).maybeSingle(),
    supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!product) notFound();

  const out = product.stock <= 0;
  const low = !out && product.stock <= LOW_STOCK_THRESHOLD;

  return (
    <div className="space-y-6">
      <div className="glass-card flex items-center gap-3 rounded-xl p-5">
        <span className="text-sm text-muted-foreground">{t("stock.onHand")}</span>
        <Badge variant={out ? "destructive" : low ? "secondary" : "outline"} className="text-base">
          {product.stock}
          {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
        </Badge>
      </div>

      <form
        action={addStockMovement.bind(null, id)}
        className="glass-card grid grid-cols-2 items-end gap-4 rounded-xl p-5 sm:grid-cols-4"
      >
        <Field label={t("stock.delta")} htmlFor="delta">
          <Input id="delta" name="delta" type="number" step="1" required />
        </Field>
        <Field label={t("stock.reason")} htmlFor="reason">
          <Select id="reason" name="reason" defaultValue="purchase">
            {MANUAL_STOCK_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`stock.reasons.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("stock.note")} htmlFor="note" hint={t("common.optional")} className="sm:col-span-2">
          <Input id="note" name="note" />
        </Field>
        <Button type="submit" size="sm">
          {t("actions.create")}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("stock.history")}</h2>
        {!movements?.length ? (
          <Empty>{t("stock.noHistory")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.incurred_on")}</th>
                    <th>{t("stock.delta")}</th>
                    <th>{t("stock.reason")}</th>
                    <th>{t("stock.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className={m.delta > 0 ? "text-emerald-600" : "text-destructive"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td>
                        <Badge variant="secondary">{t(`stock.reasons.${m.reason}`)}</Badge>
                      </td>
                      <td className="text-muted-foreground">{m.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
