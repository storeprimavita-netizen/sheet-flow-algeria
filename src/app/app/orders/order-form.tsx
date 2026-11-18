"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { WilayaCombobox } from "@/components/fields/comboboxes";
import { PhoneField } from "@/components/fields/phone-field";
import { MoneyField } from "@/components/fields/money-field";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { DELIVERY_TYPES } from "@/lib/enums";
import { createOrder } from "./actions";

type ProductOpt = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
  /** active sizes only: an inactive size is never offered on a new order */
  sizes: { id: string; label: string }[];
  images?: string[] | null;
  status?: string | null;
};
const NONE = "__none"; // Radix Select needs a non-empty sentinel for "no size yet"

type WilayaOpt = { code: number; name: string };
type FeeMap = Record<number, { home_fee: number; stopdesk_fee: number }>;

/**
 * Manual order creation — all field components (no native select / raw input).
 * State drives the auto-fill: picking a product seeds the price; picking a
 * wilaya / delivery type seeds the fee (editing it flips the source to manual).
 */
export function OrderForm({ products, wilayas, fees }: { products: ProductOpt[]; wilayas: WilayaOpt[]; fees: FeeMap }) {
  const t = useTranslations();

  const [productId, setProductId] = React.useState("");
  const [variantId, setVariantId] = React.useState(NONE);
  const [wilayaCode, setWilayaCode] = React.useState("");
  const [deliveryType, setDeliveryType] = React.useState<string>("home");
  const [feeSource, setFeeSource] = React.useState<"wilaya_table" | "manual">("wilaya_table");

  const product = products.find((p) => p.id === productId);
  const sizes = product?.sizes ?? [];

  function onProduct(id: string) {
    setProductId(id);
    setVariantId(NONE); // a size belongs to one product
  }

  const fee = fees[Number(wilayaCode)];
  const seededFee = fee ? (deliveryType === "stopdesk" ? fee.stopdesk_fee : fee.home_fee) : 0;
  // remount the money fields when the seed changes so the auto value shows
  const feeKey = `${wilayaCode}-${deliveryType}`;

  function onWilayaOrType(next: { wilaya?: string; type?: string }) {
    if (next.wilaya !== undefined) setWilayaCode(next.wilaya);
    if (next.type !== undefined) setDeliveryType(next.type);
    setFeeSource("wilaya_table");
  }

  const productOpts = products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status ?? null }));
  const wilayaOpts = wilayas.map((w) => ({ code: String(w.code), name: w.name }));

  return (
    <form action={createOrder} className="space-y-6">
      <div className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={t("fields.product")} htmlFor="product_id">
          <ProductCombobox
            products={productOpts}
            value={productId}
            onChange={onProduct}
            name="product_id"
            placeholder={t("fields.none")}
          />
        </Field>
        {sizes.length ? (
          <Field label={t("orders.sizeTitle")} hint={t("common.optional")}>
            <Select value={variantId} onValueChange={setVariantId} name="variant_id">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("orders.chooseSize")}</SelectItem>
                {sizes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <bdi>{v.label}</bdi>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label={t("fields.quantity")}>
          <QuantityStepper name="quantity" defaultValue={1} />
        </Field>
        <Field label={t("fields.unit_price")}>
          <MoneyField key={`price-${productId}`} name="sale_price" defaultValue={product?.sale_price ?? 0} />
        </Field>
      </div>

      <div className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={t("fields.customer")} htmlFor="customer_name">
          <Input id="customer_name" name="customer_name" required />
        </Field>
        <Field label={t("fields.phone")} htmlFor="customer_phone">
          <PhoneField id="customer_phone" name="customer_phone" />
        </Field>
        <Field label={t("fields.wilaya")}>
          <WilayaCombobox
            wilayas={wilayaOpts}
            value={wilayaCode}
            onChange={(v) => onWilayaOrType({ wilaya: v })}
            name="wilaya_code"
            placeholder={t("fields.none")}
          />
        </Field>
        <Field label={t("fields.city")} htmlFor="commune" hint={t("common.optional")}>
          <Input id="commune" name="commune" />
        </Field>
        <Field label={t("fields.address")} htmlFor="address" hint={t("common.optional")} className="sm:col-span-2">
          <Input id="address" name="address" />
        </Field>
        <Field label={t("fields.delivery_type")}>
          <Select value={deliveryType} onValueChange={(v) => onWilayaOrType({ type: v })} name="delivery_type">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_TYPES.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`status.delivery_type.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("fields.delivery_fee")}>
          <MoneyField
            key={`fee-${feeKey}`}
            name="delivery_fee"
            defaultValue={seededFee}
            onChange={() => setFeeSource("manual")}
          />
          <input type="hidden" name="delivery_fee_source" value={feeSource} />
        </Field>
      </div>

      <Button type="submit">{t("actions.save")}</Button>
    </form>
  );
}
