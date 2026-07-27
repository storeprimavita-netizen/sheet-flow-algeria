import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EnumSelect } from "@/components/fields/enum-select";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { Field } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_STATUSES, CURRENCY_CODES } from "@/lib/enums";
import { StatusPill } from "@/components/status-pill";
import { saveProduct } from "./actions";

type ProductRow = Tables<"products">;
type ProductCostRow = Tables<"product_costs">;

function variantsToText(variants: unknown): string {
  if (!Array.isArray(variants)) return "";
  return variants
    .map((v) => {
      if (!v || typeof v !== "object") return String(v);
      const { label, sku } = v as { label?: string; sku?: string };
      return sku ? `${label ?? ""} | ${sku}` : (label ?? "");
    })
    .join("\n");
}

export async function ProductForm({
  product,
  cost,
}: {
  product?: ProductRow;
  cost?: ProductCostRow | null;
}) {
  const t = await getTranslations();
  const editing = Boolean(product?.id);

  return (
    <form action={saveProduct.bind(null, product?.id ?? null)} className="space-y-6">
      <div className="card-surface space-y-4 rounded-xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={product?.name ?? ""} />
          </Field>
          <Field label={t("fields.sku")} htmlFor="sku" hint={t("common.optional")}>
            <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
          </Field>
          <Field label={t("fields.category")} htmlFor="category" hint={t("common.optional")}>
            <Input id="category" name="category" defaultValue={product?.category ?? ""} />
          </Field>
          <Field label={t("fields.status")}>
            <EnumSelect
              name="status"
              defaultValue={product?.status ?? "to_be_tested"}
              options={PRODUCT_STATUSES.map((s) => ({
                value: s,
                label: <StatusPill kind="product" status={s} size="sm" />,
              }))}
            />
          </Field>
          <Field label={t("fields.fabric")} htmlFor="fabric" hint={t("common.optional")}>
            <Input id="fabric" name="fabric" defaultValue={product?.fabric ?? ""} />
          </Field>
          <Field label={t("fields.price")} htmlFor="sale_price" hint={t("common.optional")}>
            <Input
              id="sale_price"
              name="sale_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.sale_price ?? ""}
            />
          </Field>
        </div>
        <Field label={t("fields.variants")} htmlFor="variants" hint={t("products.variantsHint")}>
          <Textarea id="variants" name="variants" rows={3} defaultValue={variantsToText(product?.variants)} />
        </Field>
        <Field label={t("fields.images")} htmlFor="images" hint={t("products.imagesHint")}>
          <Textarea id="images" name="images" rows={3} defaultValue={(product?.images ?? []).join("\n")} />
        </Field>
        <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
          <Textarea id="notes" name="notes" defaultValue={product?.notes ?? ""} />
        </Field>
        <SettingSwitch name="is_active" label={t("fields.active")} defaultChecked={product?.is_active ?? true} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("products.sourcing")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.costs")} htmlFor="sourcing_cost">
            <Input
              id="sourcing_cost"
              name="sourcing_cost"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={cost?.sourcing_cost ?? 0}
            />
          </Field>
          <Field label={t("fields.currency")}>
            <EnumSelect
              name="sourcing_currency"
              defaultValue={cost?.sourcing_currency ?? "DZD"}
              options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit">{editing ? t("actions.save") : t("actions.create")}</Button>
      </div>
    </form>
  );
}
