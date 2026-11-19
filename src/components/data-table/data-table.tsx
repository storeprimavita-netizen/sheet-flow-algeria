"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  SlidersHorizontal,
  Rows2,
  Rows3,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DRILL_PARAMS } from "@/lib/query-string";
import type { Column } from "./types";

const DRILL_RESET = Object.fromEntries(DRILL_PARAMS.map((k) => [k, null]));

type Density = "comfortable" | "compact";

export type DataTableProps<T> = {
  /** namespace for persisted density + column visibility */
  tableId: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** total row count across all pages (enables pagination) */
  total?: number;
  pageSize?: number;
  status?: "loading" | "error";
  onRetry?: () => void;
  /** initial density before the user's saved preference is read */
  defaultDensity?: Density;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  selectable?: boolean;
  /** rendered in the floating bar; receives selected keys + a clear callback */
  bulkActions?: (keys: string[], clear: () => void) => React.ReactNode;
  /** trailing kebab menu content per row */
  rowActions?: (row: T) => React.ReactNode;
  /** detail sheet content per row (opened on row click, deep-linked via ?row=) */
  renderSheet?: (row: T) => { title: React.ReactNode; body: React.ReactNode };
  /** extra controls on the toolbar row (start side), e.g. a view toggle */
  toolbar?: React.ReactNode;
};

// ponytail: server pagination caps rendered rows at pageSize (~25); add
// @tanstack/react-virtual only when a view actually renders 200+ unpaginated rows.

export function DataTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  total,
  pageSize = 25,
  status,
  onRetry,
  defaultDensity = "comfortable",
  empty,
  selectable,
  bulkActions,
  rowActions,
  renderSheet,
  toolbar,
}: DataTableProps<T>) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [density, setDensity] = React.useState<Density>(defaultDensity);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [focus, setFocus] = React.useState(-1);
  const [tableFocused, setTableFocused] = React.useState(false);

  React.useEffect(() => {
    const savedDensity = localStorage.getItem(`mnw:density:${tableId}`);
    if (savedDensity === "compact" || savedDensity === "comfortable") {
      setDensity(savedDensity);
    } else {
      // no per-table preference yet — fall back to the workspace-wide default from Settings → Appearance
      const globalDefault = localStorage.getItem("mnw:density:default");
      setDensity(globalDefault === "compact" ? "compact" : globalDefault === "comfortable" ? "comfortable" : defaultDensity);
    }
    const saved = localStorage.getItem(`mnw:cols:${tableId}`);
    // saved visibility wins; otherwise seed from columns marked defaultHidden
    if (saved) {
      try {
        setHidden(JSON.parse(saved));
      } catch {
        setHidden([]);
      }
    } else {
      setHidden(columns.filter((c) => c.defaultHidden).map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  function persistDensity(d: Density) {
    setDensity(d);
    localStorage.setItem(`mnw:density:${tableId}`, d);
  }
  function toggleColumn(id: string) {
    setHidden((h) => {
      const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      localStorage.setItem(`mnw:cols:${tableId}`, JSON.stringify(next));
      return next;
    });
  }

  function setParams(next: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null) sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const sortId = searchParams.get("sort");
  const sortDir = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const openRow = searchParams.get("row");

  function toggleSort(id: string) {
    // a sort change leaves statistics drill mode (the drill id page has its own order)
    if (sortId === id) setParams({ dir: sortDir === "asc" ? "desc" : "asc", page: null, ...DRILL_RESET });
    else setParams({ sort: id, dir: "asc", page: null, ...DRILL_RESET });
  }

  // a column shows unless its id is in `hidden` (seeded from defaultHidden on mount)
  const cols = columns.filter((c) => !hidden.includes(c.id));

  const keys = rows.map(rowKey);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = keys.some((k) => selected.has(k)) && !allSelected;

  function toggleAll() {
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }
  function toggleOne(k: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  const clear = () => setSelected(new Set());

  const rowH = density === "compact" ? "h-9" : "h-11";
  const pageCount = total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const openedRow = openRow != null ? rows.find((r) => rowKey(r) === openRow) : undefined;
  const sheet = openedRow && renderSheet ? renderSheet(openedRow) : null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocus((f) => Math.min(rows.length - 1, f + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocus((f) => Math.max(0, f - 1));
    } else if (e.key === "Enter" && focus >= 0 && rows[focus] && renderSheet) {
      setParams({ row: rowKey(rows[focus]) });
    }
  }

  const colStart = (c: Column<T>): string =>
    c.numeric || c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start";

  // ── States ──────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="card-surface p-8 text-center text-sm">
        <p className="font-medium text-danger">{t("table.error")}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            {t("table.retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex items-center justify-end gap-2">
        {toolbar ? <div className="me-auto flex items-center gap-1">{toolbar}</div> : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t(density === "compact" ? "table.comfortable" : "table.compact")}
          onClick={() => persistDensity(density === "compact" ? "comfortable" : "compact")}
        >
          {density === "compact" ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("table.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("table.columns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns
              .filter((c) => !c.alwaysVisible)
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.includes(c.id)}
                  onCheckedChange={() => toggleColumn(c.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* table */}
      {status !== "loading" && rows.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground">{empty?.title ?? t("common.empty")}</p>
          {empty?.description ? <p className="mt-1 text-sm text-muted-foreground">{empty.description}</p> : null}
          {empty?.action ? <div className="mt-4 flex justify-center">{empty.action}</div> : null}
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table
            className={cn("w-full border-collapse text-sm", focus >= 0 && tableFocused && "focus-visible:outline-none")}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onFocus={() => setTableFocused(true)}
            onBlur={() => setTableFocused(false)}
            role="grid"
          >
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border">
                {selectable ? (
                  <th className="w-10 px-3 py-2 text-start">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label={t("table.selectAll")}
                    />
                  </th>
                ) : null}
                {cols.map((c) => (
                  <th
                    key={c.id}
                    className={cn(
                      "px-3 py-2 font-medium text-muted-foreground",
                      colStart(c),
                      c.width,
                      c.sticky && "sticky start-0 z-20 bg-surface "
                        + "after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-border-strong",
                    )}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {c.header}
                        {sortId === c.id ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {rowActions ? <th className="w-10" /> : null}
              </tr>
            </thead>
            <tbody>
              {status === "loading"
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className={cn("border-b border-border", rowH)}>
                      {selectable ? <td className="px-3" /> : null}
                      {cols.map((c) => (
                        <td key={c.id} className="px-3">
                          <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
                        </td>
                      ))}
                      {rowActions ? <td /> : null}
                    </tr>
                  ))
                : rows.map((row, i) => {
                    const k = rowKey(row);
                    const isSel = selected.has(k);
                    return (
                      <tr
                        key={k}
                        onClick={() => (renderSheet ? setParams({ row: k }) : undefined)}
                        onMouseEnter={() => setFocus(i)}
                        className={cn(
                          "border-b border-border transition-colors",
                          rowH,
                          renderSheet && "cursor-pointer",
                          // --row-bg is the single source for the row and its frozen cell
                          "bg-(--row-bg)",
                          isSel
                            ? "[--row-bg:color-mix(in_oklab,var(--primary)_5%,var(--surface))] hover:[--row-bg:color-mix(in_oklab,var(--primary)_10%,var(--surface))]"
                            : "[--row-bg:var(--surface)] hover:[--row-bg:var(--surface-raised)]",
                          focus === i &&
                            (isSel
                              ? "[--row-bg:color-mix(in_oklab,var(--primary)_10%,var(--surface))]"
                              : "[--row-bg:var(--surface-raised)]"),
                          focus === i && tableFocused && "ring-2 ring-inset ring-ring",
                        )}
                      >
                        {selectable ? (
                          <td className="px-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleOne(k)}
                              aria-label={t("table.selectRow")}
                            />
                          </td>
                        ) : null}
                        {cols.map((c) => (
                          <td
                            key={c.id}
                            className={cn(
                              "px-3",
                              colStart(c),
                              c.width,
                              c.numeric && "num",
                              c.sticky && "sticky start-0 z-10 bg-(--row-bg) transition-colors "
                                + "after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-border-strong",
                            )}
                          >
                            {c.cell(row)}
                          </td>
                        ))}
                        {rowActions ? (
                          <td className="px-2 text-end" onClick={(e) => e.stopPropagation()}>
                            {rowActions(row)}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* pagination */}
      {total != null && pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="num">
            {t("table.page")} {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) })}
            >
              {t("common.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setParams({ page: String(page + 1) })}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* floating bulk bar */}
      {selectable && selected.size > 0 ? (
        <div className="surface-raised fixed bottom-6 start-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 rtl:translate-x-1/2">
          <span className="num text-sm font-medium">
            {selected.size} {t("common.selected")}
          </span>
          <div className="flex items-center gap-2">{bulkActions?.(Array.from(selected), clear)}</div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clear} aria-label={t("actions.cancel")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {/* detail sheet */}
      {renderSheet ? (
        <Sheet open={Boolean(sheet)} onOpenChange={(o) => !o && setParams({ row: null })}>
          <SheetContent>
            {sheet ? (
              <>
                <SheetTitle>{sheet.title}</SheetTitle>
                {sheet.body}
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
