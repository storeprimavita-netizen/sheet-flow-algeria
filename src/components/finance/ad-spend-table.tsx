"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, MoreHorizontal } from "lucide-react";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AdSpendForm } from "./ad-spend-form";

type AdSpendRow = Tables<"ad_spend_daily">;

/**
 * Shared ad-spend list — daily entries (product, amount+currency, test/scaling
 * flag), edited through the same `<AdSpendForm>` used for quick entry
 * (interconnection Rule 1). Reused unfiltered on Finance → Ad spend.
 */
export function AdSpendTable({
  rows,
  productId,
  products,
  rates,
  productName,
  total,
}: {
  rows: AdSpendRow[];
  productId?: string;
  products?: { id: string; name: string; image?: string | null; status?: string | null }[];
  rates: { USD: number; EUR: number };
  productName: Map<string, string>;
  /** Set when `rows` is one page of a longer list. */
  total?: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdSpendRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function del(id: string) {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setBusyId(id);
    const { error } = await createClient().from("ad_spend_daily").delete().eq("id", id);
    setBusyId(null);
    if (error) window.alert(error.message);
    else router.refresh();
  }

  const columns: Column<AdSpendRow>[] = [
    { id: "spent_on", header: t("fields.incurred_on"), sticky: true, cell: (a) => formatDate(a.spent_on) },
    ...(productId ? [] : [{ id: "product", header: t("fields.product"), cell: (a: AdSpendRow) => productName.get(a.product_id) ?? "—" }]),
    {
      id: "kind",
      header: t("fields.kind"),
      cell: (a) => (
        <Chip token={a.kind === "scaling" ? "violet" : "info"} size="sm">
          {t(`status.ad_kind.${a.kind}`)}
        </Chip>
      ),
    },
    {
      id: "amount",
      header: t("fields.amount"),
      numeric: true,
      cell: (a) =>
        a.currency === "DZD" ? (
          formatCurrency(a.amount_dzd)
        ) : (
          <span>
            <span className="num">{a.amount} {a.currency}</span>
            <span className="block text-xs text-muted-foreground">{formatCurrency(a.amount_dzd)}</span>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable<AdSpendRow>
        tableId="ad-spend"
        columns={columns}
        rows={rows}
        total={total}
        rowKey={(a) => a.id}
        defaultDensity="compact"
        empty={{ title: t("finance.noAdSpendInRange") }}
        rowActions={(a) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.edit")}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(a)}>
                <Pencil className="h-4 w-4" /> {t("actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => del(a.id)} disabled={busyId === a.id} className="text-danger">
                <Trash2 className="h-4 w-4" /> {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          {editing !== null ? (
            <>
              <SheetTitle>{t("actions.edit")}</SheetTitle>
              <div className="mt-4">
                <AdSpendForm
                  key={editing.id}
                  productId={productId ?? editing.product_id}
                  products={products}
                  rates={rates}
                  defaultValues={editing}
                  onDone={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
