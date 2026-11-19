"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Ban, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { Combobox } from "@/components/ui/combobox";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { WilayaCombobox } from "@/components/fields/comboboxes";
import { PhoneField } from "@/components/fields/phone-field";
import { MoneyField } from "@/components/fields/money-field";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { DELIVERY_TYPES } from "@/lib/enums";
import { deliveryFeeFor, newOrderBlock, type DeliveryType, type DeliveryFeeRow } from "@/lib/pricing-delivery";
import { useSubmitAction } from "@/lib/use-submit-action";
import { createOrder, type OrderFormState } from "./actions";

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
type FeeMap = Record<number, DeliveryFeeRow & { stop_shipping: boolean }>;

/**
 * Manual order creation — all field components (no native select / raw input).
 * State drives the auto-fill: picking a product seeds the price; picking a
 * wilaya / delivery type seeds the fee (editing it flips the source to manual).
 */
export function OrderForm({
  products,
  wilayas,
  fees,
  communes,
}: {
  products: ProductOpt[];
  wilayas: WilayaOpt[];
  fees: FeeMap;
  communes: Record<number, string[]>;
}) {
  const t = useTranslations();
  const [state, formAction] = React.useActionState<OrderFormState, FormData>((_prev, fd) => createOrder(fd), undefined);

  const onSubmit = useSubmitAction(formAction);

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

  const [commune, setCommune] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [address, setAddress] = React.useState("");

  const fee = fees[Number(wilayaCode)];
  const seededFee = deliveryFeeFor(fee, deliveryType as DeliveryType) ?? 0;
  const block = newOrderBlock(fee, deliveryType as DeliveryType);
  const stopdeskBlocked = !!fee && deliveryFeeFor(fee, "stopdesk") === null;
  const communeList = communes[Number(wilayaCode)] ?? [];
  // remount the money fields when the seed changes so the auto value shows
  const feeKey = `${wilayaCode}-${deliveryType}`;

  function onWilayaOrType(next: { wilaya?: string; type?: string }) {
    if (next.wilaya !== undefined) {
      setWilayaCode(next.wilaya);
      setCommune(""); // a commune belongs to one wilaya
      // stop-desk may not exist in the new wilaya: fall back to home
      if (deliveryFeeFor(fees[Number(next.wilaya)], "stopdesk") === null && fees[Number(next.wilaya)]) setDeliveryType("home");
    }
    if (next.type !== undefined) setDeliveryType(next.type);
    setFeeSource("wilaya_table");
  }

  const productOpts = products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status ?? null }));
  const wilayaOpts = wilayas.map((w) => ({ code: String(w.code), name: w.name }));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={`${t("fields.product")} *`} htmlFor="product_id">
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
        <Field label={t("fields.unit_price")} htmlFor="sale_price">
          <MoneyField id="sale_price" key={`price-${productId}`} name="sale_price" defaultValue={product?.sale_price ?? 0} />
        </Field>
      </div>

      <div className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
        <Field label={t("fields.customer")} htmlFor="customer_name">
          <Input id="customer_name" name="customer_name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
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
          {block ? (
            <p role="alert" className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t(`orders.form.blocked.${block}`)}
            </p>
          ) : null}
        </Field>
        <Field label={t("fields.city")} htmlFor={communeList.length ? undefined : "commune"} hint={t("common.optional")}>
          {communeList.length ? (
            <Combobox
              key={`commune-${wilayaCode}`}
              name="commune"
              options={(communeList.includes(commune) || !commune ? communeList : [commune, ...communeList]).map((c) => ({ value: c, label: c }))}
              value={commune}
              onChange={setCommune}
              onCreate={setCommune}
              createLabel={(q) => t("orders.form.useCommune", { name: q })}
              searchPlaceholder={t("orders.form.searchCommune")}
              emptyText={t("orders.form.noCommune")}
              placeholder={t("orders.form.chooseCommune")}
              ariaLabel={t("fields.city")}
            />
          ) : (
            <Input id="commune" name="commune" value={commune} onChange={(e) => setCommune(e.target.value)} dir="auto" />
          )}
        </Field>
        <Field label={t("fields.address")} htmlFor="address" hint={t("common.optional")} className="sm:col-span-2">
          <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t("fields.delivery_type")}>
          <Select value={deliveryType} onValueChange={(v) => onWilayaOrType({ type: v })} name="delivery_type">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_TYPES.map((d) => (
                <SelectItem key={d} value={d} disabled={d === "stopdesk" && stopdeskBlocked}>
                  {t(`status.delivery_type.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stopdeskBlocked && !block ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("orders.form.stopdeskUnavailable")}
            </p>
          ) : null}
        </Field>
        <Field label={t("fields.delivery_fee")} htmlFor="delivery_fee">
          <MoneyField
            id="delivery_fee"
            key={`fee-${feeKey}`}
            name="delivery_fee"
            defaultValue={seededFee}
            onChange={() => setFeeSource("manual")}
          />
          <input type="hidden" name="delivery_fee_source" value={feeSource} />
        </Field>
      </div>

      {state?.error ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
          <Ban className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          {t(`orders.form.${state.error}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={block !== null}>
          {t("actions.save")}
        </Button>
        {block ? <p className="text-xs text-muted-foreground">{t("orders.form.saveBlocked")}</p> : null}
      </div>
    </form>
  );
}
