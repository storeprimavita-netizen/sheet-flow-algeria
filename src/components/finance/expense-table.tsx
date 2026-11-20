"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";

import type { Tables } from "@/lib/supabase/database.types";
import type { OptionRow } from "@/lib/option-sets";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CATEGORY_ICONS } from "@/components/fields/category-select";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ExpenseForm } from "./expense-form";

type ExpenseRow = Tables<"expenses">;

function CategoryChip({ category }: { category: string }) {
  const t = useTranslations();
  const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
  return (
    <Chip token="neutral" size="sm" icon={Icon ? <Icon className="h-3 w-3" /> : undefined}>
      {t(`status.expense_category.${category}`)}
    </Chip>
  );
}

/**
 * Shared expenses table + create/edit sheet (interconnection Rule 1). Category
 * totals summarised above; each row edits through the same `<ExpenseForm>`.
 */
export function ExpenseTable({
  expenses,
  productId,
  products,
  suppliers,
  contactId,
  subcategories,
  accounts,
  rates,
}: {
  expenses: ExpenseRow[];
  productId?: string;
  products?: { id: string; name: string; image?: string | null; status?: string | null }[];
  suppliers: { id: string; name: string }[];
  contactId?: string;
  subcategories: OptionRow[];
  accounts?: { id: string; name: string }[];
  rates: { USD: number; EUR: number };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = React.useState<ExpenseRow | "new" | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const supplierName = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const productName = React.useMemo(() => new Map((products ?? []).map((p) => [p.id, p.name])), [products]);
  const subcategoryById = React.useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories]);

  const totalsByCategory = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + (e.amount_dzd ?? 0));
    return m;
  }, [expenses]);

  async function del(id: string) {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setBusyId(id);
    const { error } = await createClient().from("expenses").delete().eq("id", id);
    setBusyId(null);
    if (error) window.alert(error.message);
    else router.refresh();
  }

  const columns: Column<ExpenseRow>[] = [
    { id: "spent_on", header: t("fields.incurred_on"), sticky: true, cell: (e) => formatDate(e.spent_on) },
    { id: "category", header: t("fields.category"), cell: (e) => <CategoryChip category={e.category} /> },
    {
      id: "subcategory",
      header: t("fields.subcategory"),
      defaultHidden: true,
      cell: (e) => {
        const s = e.subcategory_option_id ? subcategoryById.get(e.subcategory_option_id) : undefined;
        return s ? <Chip token={s.color_token} emoji={s.emoji} size="sm">{s.label}</Chip> : "—";
      },
    },
    ...(productId
      ? []
      : [{ id: "product", header: t("fields.product"), cell: (e: ExpenseRow) => (e.product_id ? productName.get(e.product_id) ?? "—" : "—") }]),
    ...(contactId
      ? []
      : [{ id: "supplier", header: t("fields.supplier"), cell: (e: ExpenseRow) => (e.contact_id ? supplierName.get(e.contact_id) ?? "—" : "—") }]),
    {
      id: "amount",
      header: t("fields.amount"),
      numeric: true,
      cell: (e) =>
        e.currency === "DZD" ? (
          formatCurrency(e.amount_dzd)
        ) : (
          <span>
            <span className="num">{e.amount} {e.currency}</span>
            <span className="block text-xs text-muted-foreground">{formatCurrency(e.amount_dzd)}</span>
          </span>
        ),
    },
    { id: "note", header: t("fields.notes"), cell: (e) => e.note ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[...totalsByCategory.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, sum]) => (
              <span key={cat} className="inline-flex items-center gap-1.5">
                <CategoryChip category={cat} />
                <span className="num text-xs text-muted-foreground">{formatCurrency(sum)}</span>
              </span>
            ))}
        </div>
        <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("expenses.new")}
        </Button>
      </div>

      <DataTable<ExpenseRow>
        tableId="expenses"
        columns={columns}
        rows={expenses}
        rowKey={(e) => e.id}
        defaultDensity="compact"
        empty={{ title: t("expenses.none"), description: t("expenses.emptyHint") }}
        rowActions={(e) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.edit")}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(e)}>
                <Pencil className="h-4 w-4" /> {t("actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => del(e.id)} disabled={busyId === e.id} className="text-danger">
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
              <SheetTitle>{editing === "new" ? t("expenses.new") : t("expenses.edit")}</SheetTitle>
              <div className="mt-4">
                <ExpenseForm
                  expense={editing === "new" ? undefined : editing}
                  productId={productId}
                  products={products}
                  suppliers={suppliers}
                  contactId={contactId}
                  subcategories={subcategories}
                  accounts={accounts}
                  rates={rates}
                  onDone={() => setEditing(null)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
