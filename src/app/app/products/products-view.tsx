"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LayoutGrid, Table2, MoreHorizontal, Pencil, Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { PRODUCT_STATUSES } from "@/lib/enums";
import type { StatusToken } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/status-pill";
import { Sparkline } from "@/components/ui/sparkline";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setProductStatusValue } from "./actions";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: { label: string; token: StatusToken } | null;
  image: string | null;
  status: string;
  sale_price: number | null;
  stock: number;
  low_stock_threshold: number;
  delivery_rate: number | null;
  net_profit: number | null;
  created_at: string;
  spark: number[];
};

export function ProductsView({ rows }: { rows: ProductRow[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "table" ? "table" : "grid";

  function setView(v: "grid" | "table") {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "grid") sp.delete("view");
    else sp.set("view", v);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  async function changeStatus(id: string, status: string) {
    const res = await setProductStatusValue(id, status);
    if (res.ok) {
      toast.success(t("common.updated"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const empty = (
    <div className="card-surface p-10 text-center">
      <p className="text-sm font-medium text-foreground">{t("products.none")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("products.emptyHint")}</p>
      <div className="mt-4 flex justify-center">
        <ButtonLink href="/app/products/new" size="sm">
          {t("products.new")}
        </ButtonLink>
      </div>
    </div>
  );

  const kebab = (r: ProductRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.view")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/app/products/${r.id}`}>
            <Pencil className="h-4 w-4" /> {t("actions.edit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("fields.status")}</DropdownMenuLabel>
        {PRODUCT_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => changeStatus(r.id, s)}>
            <StatusPill kind="product" status={s} size="sm" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<ProductRow>[] = [
    {
      id: "name",
      header: t("fields.name"),
      sortable: true,
      sticky: true,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Thumb src={r.image} className="h-7 w-7" />
          <div className="min-w-0">
            <Link href={`/app/products/${r.id}`} className="truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {r.name}
            </Link>
            {r.sku ? <div className="text-xs text-muted-foreground">{r.sku}</div> : null}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: t("fields.category"),
      cell: (r) => (r.category ? <Chip token={r.category.token} size="sm">{r.category.label}</Chip> : "—"),
    },
    { id: "sale_price", header: t("fields.price"), numeric: true, sortable: true, cell: (r) => formatCurrency(r.sale_price) },
    {
      id: "stock",
      header: t("stock.stock"),
      numeric: true,
      sortable: true,
      cell: (r) => <StockChip stock={r.stock} threshold={r.low_stock_threshold} outLabel={t("stock.out")} lowLabel={t("stock.low")} />,
    },
    {
      id: "delivery_rate",
      header: t("products.statistics.deliveryRate"),
      numeric: true,
      cell: (r) => (r.delivery_rate !== null ? `${r.delivery_rate}%` : "—"),
    },
    {
      id: "net_profit",
      header: t("products.statistics.netProfit"),
      numeric: true,
      cell: (r) => <NetProfit value={r.net_profit} href={`/app/products/${r.id}/statistics`} />,
    },
    {
      id: "status",
      header: t("fields.status"),
      align: "center",
      cell: (r) => <StatusPill kind="product" status={r.status} size="sm" />,
    },
    { id: "created_at", header: t("fields.placed_at"), sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-md border border-border p-0.5">
          <ToggleBtn active={view === "grid"} onClick={() => setView("grid")} label={t("products.viewGrid")}>
            <LayoutGrid className="h-4 w-4" />
          </ToggleBtn>
          <ToggleBtn active={view === "table"} onClick={() => setView("table")} label={t("products.viewTable")}>
            <Table2 className="h-4 w-4" />
          </ToggleBtn>
        </div>
      </div>

      {rows.length === 0 ? (
        empty
      ) : view === "table" ? (
        <DataTable<ProductRow>
          tableId="products"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowActions={kebab}
          empty={{ title: t("products.none"), description: t("products.emptyHint") }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => (
            <ProductCard key={r.id} row={r} kebab={kebab(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded transition-colors",
        active ? "bg-primary text-primary-fg" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Thumb({ src, className }: { src: string | null; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- external supplier URLs, no next/image domain config
    <img src={src} alt="" className={cn("shrink-0 rounded object-cover", className)} />
  ) : (
    <span className={cn("shrink-0 rounded bg-surface-raised", className)} />
  );
}

function StockChip({ stock, threshold, outLabel, lowLabel }: { stock: number; threshold: number; outLabel: string; lowLabel: string }) {
  const out = stock <= 0;
  const low = !out && stock <= threshold;
  return (
    <Chip token={out ? "danger" : low ? "warning" : "neutral"} size="sm">
      <span className="num">{stock}</span>
      {out ? ` · ${outLabel}` : low ? ` · ${lowLabel}` : ""}
    </Chip>
  );
}

function NetProfit({ value, href }: { value: number | null; href: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn("num font-medium hover:underline", value >= 0 ? "text-success" : "text-danger")}
    >
      {formatCurrency(value)}
    </Link>
  );
}

function ProductCard({ row, kebab }: { row: ProductRow; kebab: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="card-surface flex h-full flex-col overflow-hidden rounded-xl">
      {/* no image → compact icon strip, not a half-card grey block */}
      <Link href={`/app/products/${row.id}`} className={cn("relative block bg-surface-raised", row.image ? "aspect-[4/3]" : "h-14")}>
        {row.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-faint">
            <ImageIcon className="h-5 w-5" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/app/products/${row.id}`} className="line-clamp-2 min-h-[2.5rem] font-medium leading-tight hover:underline">
            {row.name}
          </Link>
          {kebab}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill kind="product" status={row.status} size="sm" />
          <StockChip stock={row.stock} threshold={row.low_stock_threshold} outLabel={t("stock.out")} lowLabel={t("stock.low")} />
        </div>
        <div className="mt-auto flex items-end justify-between">
          <div className="space-y-1">
            <div className="num text-lg font-semibold">{formatCurrency(row.sale_price)}</div>
            <div className="text-xs text-muted-foreground">
              {t("products.statistics.deliveryRate")}: {row.delivery_rate !== null ? `${row.delivery_rate}%` : "—"}
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">{t("products.statistics.netProfit")}: </span>
              <NetProfit value={row.net_profit} href={`/app/products/${row.id}/statistics`} />
            </div>
          </div>
          <div className={cn("shrink-0", (row.net_profit ?? 0) >= 0 ? "text-success" : "text-danger")}>
            <Sparkline data={row.spark} />
          </div>
        </div>
      </div>
    </div>
  );
}
