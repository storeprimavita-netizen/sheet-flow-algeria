"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { swapOrder } from "../actions";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Order statuses from which a swap is meaningful. */
const SWAPPABLE = new Set(["returning", "returned", "exchange", "delivered"]);

export function SwapCard({
  orderId,
  deliveryStatus,
  swappedTo,
  swappedFrom,
  wilayas,
}: {
  orderId: string;
  deliveryStatus: string;
  swappedTo: { id: string; orderNumber: string | null } | null;
  swappedFrom: { id: string; orderNumber: string | null } | null;
  wilayas: { code: number; name: string }[];
}) {
  const t = useTranslations("orders.swap");
  const canSwap = !swappedTo && SWAPPABLE.has(deliveryStatus);

  return (
    <div className="card-surface rounded-xl p-5 space-y-3">
      {swappedTo ? (
        <p className="text-sm">
          {t("swappedTo", { number: swappedTo.orderNumber ?? swappedTo.id.slice(0, 8) })}{" "}
          <Link href={`/app/orders/${swappedTo.id}`} className="underline">→</Link>
        </p>
      ) : null}
      {swappedFrom ? (
        <p className="text-sm">
          {t("swappedFrom", { number: swappedFrom.orderNumber ?? swappedFrom.id.slice(0, 8) })}{" "}
          <Link href={`/app/orders/${swappedFrom.id}`} className="underline">←</Link>
        </p>
      ) : null}
      {canSwap ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t("title")}</summary>
          <form action={swapOrder.bind(null, orderId)} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("customerName")} htmlFor="swap-name">
              <Input id="swap-name" name="customer_name" required />
            </Field>
            <Field label={t("customerPhone")} htmlFor="swap-phone">
              <Input id="swap-phone" name="customer_phone" type="tel" required />
            </Field>
            <Field label={t("wilaya")}>
              <Input name="wilaya_code" list="swap-wilayas" required />
              <datalist id="swap-wilayas">
                {wilayas.map((w) => (
                  <option key={w.code} value={String(w.code)}>{w.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label={t("commune")} htmlFor="swap-commune">
              <Input id="swap-commune" name="commune" />
            </Field>
            <Field label={t("address")} htmlFor="swap-address" className="sm:col-span-2">
              <Input id="swap-address" name="address" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}
