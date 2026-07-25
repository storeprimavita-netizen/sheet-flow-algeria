"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { PRODUCT_STATUSES } from "@/lib/enums";

type ProductRow = Tables<"products">;

const COST_FIELDS = [
  "cost_shooting",
  "cost_packaging",
  "cost_sampling",
  "cost_confirmation",
  "cost_delivery",
  "cost_test_ads",
  "cost_scaling_ads",
] as const;

const num = (v: FormDataEntryValue | null): number | null => {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};

export function ProductForm({ product }: { product?: ProductRow }) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(product?.id);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const opt = (name: string) => String(fd.get(name) ?? "").trim() || null;

    const payload: TablesInsert<"products"> = {
      name: String(fd.get("name") ?? "").trim(),
      status: String(fd.get("status") ?? "to_be_tested") as Enums<"product_status">,
      sku: opt("sku"),
      description: opt("description"),
      category: opt("category"),
      material: opt("material"),
      fabric: opt("fabric"),
      image_url: opt("image_url"),
      selling_price: num(fd.get("selling_price")),
      is_active: fd.get("is_active") === "on",
    };
    for (const k of COST_FIELDS) payload[k] = num(fd.get(k)) ?? 0;

    const supabase = createClient();
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", product!.id)
      : await supabase.from("products").insert(payload);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app/products");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="glass-card space-y-4 rounded-xl p-5">
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
          <Field label={t("fields.status")} htmlFor="status">
            <Select id="status" name="status" defaultValue={product?.status ?? "to_be_tested"}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.product_status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.material")} htmlFor="material" hint={t("common.optional")}>
            <Input id="material" name="material" defaultValue={product?.material ?? ""} />
          </Field>
          <Field label={t("fields.fabric")} htmlFor="fabric" hint={t("common.optional")}>
            <Input id="fabric" name="fabric" defaultValue={product?.fabric ?? ""} />
          </Field>
          <Field label={t("fields.image_url")} htmlFor="image_url" hint={t("common.optional")}>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              defaultValue={product?.image_url ?? ""}
            />
          </Field>
          <Field label={t("fields.price")} htmlFor="selling_price">
            <Input
              id="selling_price"
              name="selling_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.selling_price ?? ""}
            />
          </Field>
        </div>
        <Field label={t("fields.description")} htmlFor="description" hint={t("common.optional")}>
          <Textarea id="description" name="description" defaultValue={product?.description ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} />
          {t("fields.active")}
        </label>
      </div>

      <div className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("fields.costs")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COST_FIELDS.map((k) => {
            const category = k.replace("cost_", "");
            return (
              <Field key={k} label={t(`status.expense_category.${category}`)} htmlFor={k}>
                <Input
                  id={k}
                  name={k}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product?.[k] ?? 0}
                />
              </Field>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
