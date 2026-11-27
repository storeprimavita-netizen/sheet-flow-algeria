"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdSpendForm } from "@/components/finance/ad-spend-form";

/**
 * Quick-actions "Add ad spend" — the 4 fields (product, date, amount+currency,
 * test/scaling) in a modal, not an inline widget stuffed into the dashboard
 * (UI_AUDIT finding). Wraps the shared `<AdSpendForm>` — same record, same
 * component as the product page and Finance → Ad spend (interconnection Rule 1).
 */
export function AddAdSpendModal({
  products,
  rates,
}: {
  products: { id: string; name: string; image?: string | null; status?: string | null }[];
  rates: { USD: number; EUR: number };
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-1.5 max-sm:min-h-11">
          <Plus className="h-4 w-4" />
          {t("cmd.addAdSpend")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cmd.addAdSpend")}</DialogTitle>
        </DialogHeader>
        <AdSpendForm products={products} rates={rates} className="space-y-4" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
