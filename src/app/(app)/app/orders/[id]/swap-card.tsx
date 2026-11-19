"use client";

import { formatOrderNo, ltr } from "@/lib/format";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useActionState } from "react";
import { useSubmitAction } from "@/lib/use-submit-action";
import { swapOrder } from "../actions";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Order statuses from which a swap is meaningful. */
const SWAPPABLE = new Set(["returning", "returned"]);

export function SwapCard({
  orderId,
  deliveryStatus,
  swappedTo,
  swappedFrom,
  wilayas,
}: {
  orderId: string;
  deliveryStatus: string;
  swappedTo: { id: string; orderSeq: number } | null;
  swappedFrom: { id: string; orderSeq: number } | null;
  wilayas: { code: number; name: string }[];
}) {
  const t = useTranslations("orders.swap");
  const tOrders = useTranslations("orders");
  const [state, formAction] = useActionState<{ error: string } | undefined, FormData>((_prev, fd) => swapOrder(orderId, fd), undefined);
  const onSubmit = useSubmitAction(formAction);
  const canSwap = !swappedTo && SWAPPABLE.has(deliveryStatus);
  if (!swappedTo && !swappedFrom && !canSwap) return null; // nothing to show → no empty card

  return (
    <div className="card-surface rounded-xl p-5 space-y-3">
      {swappedTo ? (
        <p className="text-sm">
          {t("swappedTo", { number: ltr(formatOrderNo(swappedTo.orderSeq)) })}{" "}
          <Link href={`/app/orders/${swappedTo.id}`} className="underline">→</Link>
        </p>
      ) : null}
      {swappedFrom ? (
        <p className="text-sm">
          {t("swappedFrom", { number: ltr(formatOrderNo(swappedFrom.orderSeq)) })}{" "}
          <Link href={`/app/orders/${swappedFrom.id}`} className="underline">←</Link>
        </p>
      ) : null}
      {canSwap ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t("title")}</summary>
          <form method="post" onSubmit={onSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {state?.error ? (
              <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger sm:col-span-2">
                {tOrders(state.error)}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}
