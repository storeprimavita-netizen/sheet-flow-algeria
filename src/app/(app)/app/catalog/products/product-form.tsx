import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { requireProfile } from "@/lib/rbac";
import { getOptionSet } from "@/lib/option-sets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EnumSelect } from "@/components/fields/enum-select";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { OptionSelect } from "@/components/fields/option-select";
import { Field } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_STATUSES, CURRENCY_CODES } from "@/lib/enums";
import { StatusPill } from "@/components/status-pill";
import { saveProduct } from "./actions";

type ProductRow = Tables<"products">;
type ProductCostRow = Tables<"product_costs">;

export async function ProductForm({
  product,
  cost,
}: {
  product?: ProductRow;
  cost?: ProductCostRow | null;
}) {
  const t = await getTranslations();
  const editing = Boolean(product?.id);
  const { workspaceId } = await requireProfile();
  const [categories, fabrics] = await Promise.all([
    getOptionSet(workspaceId, "product_category"),
    getOptionSet(workspaceId, "product_fabric"),
  ]);

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
          <Field label={t("fields.category")} hint={t("common.optional")}>
            <OptionSelect
              setKey="product_category"
              name="category_option_id"
              value={product?.category_option_id ?? undefined}
              options={categories.map((c) => ({ value: c.id, label: c.label, token: c.color_token, emoji: c.emoji, archived: !!c.archived_at }))}
              placeholder={t("fields.category")}
            />
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
          <Field label={t("fields.fabric")} hint={t("common.optional")}>
            <OptionSelect
              setKey="product_fabric"
              name="fabric_option_id"
              value={product?.fabric_option_id ?? undefined}
              options={fabrics.map((f) => ({ value: f.id, label: f.label, token: f.color_token, emoji: f.emoji, archived: !!f.archived_at }))}
              placeholder={t("fields.fabric")}
            />
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{editing ? t("actions.save") : t("actions.create")}</Button>
        <p className="text-xs text-muted-foreground">{editing ? t("products.sizesSaveSeparately") : t("products.sizesAfterFirstSave")}</p>
      </div>
    </form>
  );
}
