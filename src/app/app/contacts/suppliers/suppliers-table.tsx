"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { SUPPLIER_TYPE_ICONS } from "@/components/fields/supplier-type-select";
import { SUPPLIER_TYPE_TOKEN } from "@/lib/statuses";
import { formatCurrency } from "@/lib/format";

export type SupplierRow = {
  id: string;
  name: string;
  type: string;
  phones: string[];
  location: string | null;
  expensesTotal: number;
};

function TypeChip({ type }: { type: string }) {
  const t = useTranslations();
  const Icon = SUPPLIER_TYPE_ICONS[type as keyof typeof SUPPLIER_TYPE_ICONS];
  return (
    <Chip token={SUPPLIER_TYPE_TOKEN[type] ?? "neutral"} size="sm" icon={Icon ? <Icon className="h-3 w-3" /> : undefined}>
      {t(`status.supplier_type.${type}`)}
    </Chip>
  );
}

export function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  const t = useTranslations();

  const columns: Column<SupplierRow>[] = [
    {
      id: "name",
      header: t("fields.name"),
      sortable: true,
      sticky: true,
      cell: (r) => (
        <Link href={`/app/contacts/suppliers/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    { id: "type", header: t("fields.type"), cell: (r) => <TypeChip type={r.type} /> },
    {
      id: "phone",
      header: t("fields.phone"),
      cell: (r) =>
        r.phones.length ? (
          <a href={`tel:${r.phones[0]}`} onClick={(e) => e.stopPropagation()} className="num text-info hover:underline">
            {r.phones.join(", ")}
          </a>
        ) : (
          "—"
        ),
    },
    { id: "location", header: t("fields.location"), cell: (r) => r.location ?? "—" },
    {
      id: "expenses",
      header: t("contacts.linkedExpenses"),
      numeric: true,
      sortable: true,
      cell: (r) => formatCurrency(r.expensesTotal),
    },
  ];

  return (
    <DataTable<SupplierRow>
      tableId="contacts-suppliers"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={{
        title: t("contacts.suppliersNone"),
        action: (
          <ButtonLink href="/app/contacts/suppliers/new" size="sm">
            {t("contacts.newSupplier")}
          </ButtonLink>
        ),
      }}
      rowActions={(r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.edit")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/app/contacts/suppliers/${r.id}`}>
                <Pencil className="h-4 w-4" /> {t("actions.edit")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
