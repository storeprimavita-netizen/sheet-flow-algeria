import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { MANUAL_STOCK_REASONS } from "@/lib/enums";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EnumSelect } from "@/components/fields/enum-select";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { StatusPill } from "@/components/status-pill";
import { loadProductVariants } from "@/lib/catalog/variants-data";
import { addStockMovement } from "../../actions";
import { CountBySize } from "./count-by-size";

const NONE = "__none";

export default async function ProductStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: product }, { data: stages }, { data: movements }, variantMap, { data: sizeStock }] = await Promise.all([
    supabase.from("products").select("stock, low_stock_threshold").eq("id", id).maybeSingle(),
    supabase.from("product_stock_stages").select("in_stock, reserved, on_road, delivered").eq("product_id", id).maybeSingle(),
    supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    loadProductVariants(supabase, [id]),
    supabase.from("product_variant_stock_v").select("not_assigned, count_needed").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();

  const variants = variantMap.get(id)?.variants ?? [];
  const labelOf = new Map(variants.map((v) => [v.id, v.label]));
  const notAssigned = sizeStock?.not_assigned ?? 0;
  const out = product.stock <= 0;
  const low = !out && product.stock <= product.low_stock_threshold;

  return (
    <div className="space-y-6">
      <div className="card-surface flex items-center gap-3 rounded-xl p-5">
        <span className="text-sm text-muted-foreground">{t("stock.onHand")}</span>
        <Chip token={out ? "danger" : low ? "warning" : "neutral"}>
          <span className="num">{product.stock}</span>
          {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
        </Chip>
        {stages && (
          <dl className="ms-auto flex flex-wrap gap-x-6 gap-y-2 text-sm" title={t("stock.stages.hint")}>
            {(
              [
                ["inStock", stages.in_stock],
                ["reserved", stages.reserved],
                ["onRoad", stages.on_road],
                ["delivered", stages.delivered],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">{t(`stock.stages.${k}`)}</dt>
                <dd className="num font-medium">{v ?? 0}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {variants.length ? (
        <div className="card-surface space-y-3 rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold">{t("stock.sizesTitle")}</h2>
            {sizeStock?.count_needed ? <StatusPill kind="stock" status="count_needed" size="sm" /> : null}
          </div>
          <div className="overflow-x-auto">
            <table className={`${tableClass}`}>
              <thead>
                <tr>
                  <th>{t("stock.size")}</th>
                  <th className="!text-end">{t("fields.quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className={v.isActive ? "" : "opacity-70"}>
                    <td>
                      <bdi className="font-medium">{v.label}</bdi>
                      {!v.isActive ? <Chip token="neutral" size="sm" className="ms-2">{t("stock.inactive")}</Chip> : null}
                    </td>
                    <td className={v.stock < 0 ? "num text-end text-danger" : "num text-end"}>{v.stock}</td>
                  </tr>
                ))}
                <tr>
                  <td className="text-muted-foreground" title={t("stock.notAssignedHint")}>
                    {t("stock.notAssigned")}
                  </td>
                  <td className="num text-end">{notAssigned}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <CountBySize
        productId={id}
        rows={variants.filter((v) => v.isActive || v.stock !== 0).map((v) => ({ id: v.id, label: v.isActive ? v.label : t("orders.sizeInactive", { label: v.label }), stock: v.stock }))}
        notAssigned={notAssigned}
      />

      <form
        action={addStockMovement.bind(null, id)}
        className="card-surface grid grid-cols-2 items-end gap-4 rounded-xl p-5 sm:grid-cols-4"
      >
        <Field label={t("stock.delta")} htmlFor="delta">
          <Input id="delta" name="delta" type="number" step="1" required />
        </Field>
        <Field label={t("stock.reason")}>
          <EnumSelect
            name="reason"
            defaultValue="purchase"
            options={MANUAL_STOCK_REASONS.map((r) => ({ value: r, label: t(`stock.reasons.${r}`) }))}
          />
        </Field>
        {variants.length ? (
          <Field label={t("stock.variantPicker")}>
            <EnumSelect
              name="variant_id"
              defaultValue={NONE}
              options={[
                { value: NONE, label: t("stock.sizeNone") },
                ...variants.filter((v) => v.isActive || v.stock !== 0).map((v) => ({ value: v.id, label: <bdi>{v.isActive ? v.label : t("orders.sizeInactive", { label: v.label })}</bdi> })),
              ]}
            />
          </Field>
        ) : null}
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
          <div className="card-surface overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.incurred_on")}</th>
                    <th>{t("stock.delta")}</th>
                    <th>{t("stock.reason")}</th>
                    {variants.length ? <th>{t("stock.size")}</th> : null}
                    <th>{t("stock.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-raised">
                      <td className="text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className={m.delta > 0 ? "num text-success" : "num text-danger"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td>
                        <Chip token="neutral" size="sm">{t(`stock.reasons.${m.reason}`)}</Chip>
                      </td>
                      {variants.length ? (
                        <td className="text-muted-foreground">{m.variant_id ? <bdi>{labelOf.get(m.variant_id) ?? "—"}</bdi> : "—"}</td>
                      ) : null}
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
