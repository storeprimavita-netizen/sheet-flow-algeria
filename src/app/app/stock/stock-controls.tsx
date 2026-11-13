"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

import { MANUAL_STOCK_REASONS } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { EnumSelect } from "@/components/fields/enum-select";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addStockMovement, setLowStockThreshold } from "../products/actions";

/** One "Adjust" button per row → dialog with Δ / reason / note (was 4 inline controls per row). */
export function StockAdjustDialog({ productId, name }: { productId: string; name: string }) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("stock.adjust")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t("stock.adjustTitle", { name })}</DialogTitle>
        <form
          action={async (fd) => {
            await addStockMovement(productId, fd);
            setOpen(false);
            toast.success(t("common.updated"));
          }}
          className="space-y-4"
        >
          <Field label={t("stock.delta")} hint={t("stock.deltaHint")} htmlFor={`delta-${productId}`}>
            <Input id={`delta-${productId}`} name="delta" type="number" step="1" required autoFocus />
          </Field>
          <Field label={t("stock.reason")}>
            <EnumSelect
              name="reason"
              defaultValue="purchase"
              options={MANUAL_STOCK_REASONS.map((r) => ({ value: r, label: t(`stock.reasons.${r}`) }))}
            />
          </Field>
          <Field label={t("stock.note")} hint={t("common.optional")} htmlFor={`note-${productId}`}>
            <Input id={`note-${productId}`} name="note" />
          </Field>
          <Button type="submit" className="w-full">
            {t("stock.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Inline threshold editor — saves on blur/Enter when the value changed. */
export function ThresholdInput({ productId, value, label }: { productId: string; value: number; label: string }) {
  const router = useRouter();
  const [v, setV] = React.useState(String(value));
  async function commit() {
    const n = Number(v);
    if (v === String(value)) return;
    const res = await setLowStockThreshold(productId, n);
    if (!res.ok) {
      toast.error(res.error);
      setV(String(value));
    } else router.refresh();
  }
  return (
    <Input
      aria-label={label}
      type="number"
      min={0}
      step={1}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="num h-8 w-20"
    />
  );
}
