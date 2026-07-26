"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { DELIVERY_TYPES } from "@/lib/enums";
import { createOrder } from "./actions";

type ProductOpt = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
  variants: unknown;
};
type WilayaOpt = { code: number; name: string };
type FeeMap = Record<number, { home_fee: number; stopdesk_fee: number }>;

/**
 * Manual order creation. No client fetching or client-side insert (Phase 0
 * debt) — lists come from the server page, submission is the `createOrder`
 * server action. Sale price / delivery fee auto-fill via plain DOM writes on
 * change (same no-state pattern as CurrencyRateFields), staying editable.
 */
export function OrderForm({
  products,
  wilayas,
  fees,
}: {
  products: ProductOpt[];
  wilayas: WilayaOpt[];
  fees: FeeMap;
}) {
  const t = useTranslations();

  function onProductChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = e.currentTarget.form;
    const product = products.find((p) => p.id === e.target.value);

    const salePrice = form?.elements.namedItem("sale_price") as HTMLInputElement | null;
    if (salePrice && product?.sale_price != null) salePrice.value = String(product.sale_price);

    const datalist = form?.querySelector<HTMLDataListElement>("#variant-options");
    if (datalist) {
      datalist.replaceChildren();
      const variants = Array.isArray(product?.variants) ? (product.variants as { label: string }[]) : [];
      for (const v of variants) {
        const opt = document.createElement("option");
        opt.value = v.label;
        datalist.appendChild(opt);
      }
    }
  }

  function fillDeliveryFee(form: HTMLFormElement | null) {
    if (!form) return;
    const wilayaCode = Number((form.elements.namedItem("wilaya_code") as HTMLSelectElement | null)?.value);
    const type = (form.elements.namedItem("delivery_type") as HTMLSelectElement | null)?.value;
    const fee = fees[wilayaCode];
    if (!fee) return;
    const feeInput = form.elements.namedItem("delivery_fee") as HTMLInputElement | null;
    const source = form.elements.namedItem("delivery_fee_source") as HTMLInputElement | null;
    if (feeInput) feeInput.value = String(type === "stopdesk" ? fee.stopdesk_fee : fee.home_fee);
    if (source) source.value = "wilaya_table";
  }

  return (
    <form action={createOrder} className="space-y-6">
      <div className="glass-card grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={t("fields.product")} htmlFor="product_id">
          <Select id="product_id" name="product_id" required defaultValue="" onChange={onProductChange}>
            <option value="" disabled>
              {t("fields.none")}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.sku ? ` (${p.sku})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.variant")} htmlFor="variant" hint={t("common.optional")}>
          <Input id="variant" name="variant" list="variant-options" />
          <datalist id="variant-options" />
        </Field>
        <Field label={t("fields.quantity")} htmlFor="quantity">
          <Input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue="1" required />
        </Field>
        <Field label={t("fields.unit_price")} htmlFor="sale_price">
          <Input id="sale_price" name="sale_price" type="number" min="0" step="0.01" required />
        </Field>
      </div>

      <div className="glass-card grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={t("fields.customer")} htmlFor="customer_name">
          <Input id="customer_name" name="customer_name" required />
        </Field>
        <Field label={t("fields.phone")} htmlFor="customer_phone">
          <Input id="customer_phone" name="customer_phone" required />
        </Field>
        <Field label={t("fields.wilaya")} htmlFor="wilaya_code">
          <Select
            id="wilaya_code"
            name="wilaya_code"
            required
            defaultValue=""
            onChange={(e) => fillDeliveryFee(e.currentTarget.form)}
          >
            <option value="" disabled>
              {t("fields.none")}
            </option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.city")} htmlFor="commune" hint={t("common.optional")}>
          <Input id="commune" name="commune" />
        </Field>
        <Field label={t("fields.address")} htmlFor="address" hint={t("common.optional")} className="sm:col-span-2">
          <Input id="address" name="address" />
        </Field>
        <Field label={t("fields.delivery_type")} htmlFor="delivery_type">
          <Select
            id="delivery_type"
            name="delivery_type"
            defaultValue="home"
            onChange={(e) => fillDeliveryFee(e.currentTarget.form)}
          >
            {DELIVERY_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`status.delivery_type.${d}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.delivery_fee")} htmlFor="delivery_fee">
          <Input
            id="delivery_fee"
            name="delivery_fee"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
            onChange={(e) => {
              const source = e.currentTarget.form?.elements.namedItem(
                "delivery_fee_source",
              ) as HTMLInputElement | null;
              if (source) source.value = "manual";
            }}
          />
          <input type="hidden" name="delivery_fee_source" defaultValue="wilaya_table" />
        </Field>
      </div>

      <Button type="submit">{t("actions.save")}</Button>
    </form>
  );
}
