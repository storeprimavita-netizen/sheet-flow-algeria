"use client";

import { formatOrderNo, ltr } from "@/lib/format";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

import { useActionState, useState, type FormEvent } from "react";
import { useSubmitAction } from "@/lib/use-submit-action";
import { swapOrder } from "../actions";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { PhoneField } from "@/components/fields/phone-field";
import { WilayaCombobox } from "@/components/fields/comboboxes";
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
  const submitAction = useSubmitAction(formAction);
  const [wilaya, setWilaya] = useState("");
  const [missingWilaya, setMissingWilaya] = useState(false);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!wilaya) {
      e.preventDefault();
      setMissingWilaya(true);
      return;
    }
    submitAction(e);
  };
  const canSwap = !swappedTo && SWAPPABLE.has(deliveryStatus);
  if (!swappedTo && !swappedFrom && !canSwap) return null; // nothing to show → no empty card

  return (
    <div className="card-surface rounded-xl p-5 space-y-3">
      {swappedTo ? (
        <p className="text-sm">
          {t("swappedTo", { number: ltr(formatOrderNo(swappedTo.orderSeq)) })}{" "}
          <Link
            href={`/app/orders/${swappedTo.id}`}
            aria-label={t("swappedTo", { number: ltr(formatOrderNo(swappedTo.orderSeq)) })}
            className="inline-flex align-middle"
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </Link>
        </p>
      ) : null}
      {swappedFrom ? (
        <p className="text-sm">
          {t("swappedFrom", { number: ltr(formatOrderNo(swappedFrom.orderSeq)) })}{" "}
          <Link
            href={`/app/orders/${swappedFrom.id}`}
            aria-label={t("swappedFrom", { number: ltr(formatOrderNo(swappedFrom.orderSeq)) })}
            className="inline-flex align-middle"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </Link>
        </p>
      ) : null}
      {canSwap ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("title")}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <form method="post" onSubmit={onSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("customerName")} htmlFor="swap-name">
              <Input id="swap-name" name="customer_name" required />
            </Field>
            <Field label={t("customerPhone")} htmlFor="swap-phone">
              <PhoneField id="swap-phone" name="customer_phone" required />
            </Field>
            <Field label={t("wilaya")} htmlFor="swap-wilaya">
              <WilayaCombobox
                wilayas={wilayas.map((w) => ({ code: String(w.code), name: w.name }))}
                name="wilaya_code"
                id="swap-wilaya"
                value={wilaya}
                onChange={(v) => {
                  setWilaya(v);
                  setMissingWilaya(false);
                }}
                placeholder={t("wilaya")}
                ariaLabel={t("wilaya")}
              />
            </Field>
            <Field label={t("commune")} htmlFor="swap-commune">
              <Input id="swap-commune" name="commune" />
            </Field>
            <Field label={t("address")} htmlFor="swap-address" className="sm:col-span-2">
              <Input id="swap-address" name="address" />
            </Field>
            {missingWilaya ? (
              <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger sm:col-span-2">
                {t("wilayaRequired")}
              </p>
            ) : state?.error ? (
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
