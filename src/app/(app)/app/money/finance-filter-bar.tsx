"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/fields/date-field";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/chip";
import { SelectOptionRow } from "@/components/fields/select-option-row";
import { EXPENSE_CATEGORIES, AD_KINDS } from "@/lib/enums";
import { EXPENSE_CATEGORY_TOKEN, type StatusToken } from "@/lib/statuses";
import { parseFinanceFilters } from "./finance-filters";

type Opt = { value: string; label: string; token?: StatusToken };

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row

/**
 * URL-persisted filter bar shared by every Finance subsection (date range +
 * optional product/category/kind) — same shape as orders-filter-bar.tsx.
 */
export function FinanceFilterBar({
  products,
  showProduct = true,
  showCategory = false,
  showKind = false,
}: {
  products: Opt[];
  showProduct?: boolean;
  showCategory?: boolean;
  showKind?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Same parsing as the page: a malformed value shows no chip and never reaches the date picker.
  const filters = parseFinanceFilters(Object.fromEntries(sp));
  const get = (k: keyof typeof filters) => filters[k] ?? "";

  function setDates(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of [["from", from], ["to", to]] as const) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v || v === ALL) next.delete(k);
    else next.set(k, v);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const categoryOpts: Opt[] = EXPENSE_CATEGORIES.map((c) => ({
    value: c,
    label: t(`status.expense_category.${c}`),
    token: EXPENSE_CATEGORY_TOKEN[c],
  }));
  const kindOpts: Opt[] = AD_KINDS.map((k) => ({ value: k, label: t(`status.ad_kind.${k}`) }));

  const selects: { key: "product" | "category" | "kind"; label: string; opts: Opt[] }[] = [
    ...(showProduct ? [{ key: "product" as const, label: t("fields.product"), opts: products }] : []),
    ...(showCategory ? [{ key: "category" as const, label: t("fields.category"), opts: categoryOpts }] : []),
    ...(showKind ? [{ key: "kind" as const, label: t("fields.kind"), opts: kindOpts }] : []),
  ];

  const chips: { key: string; label: string }[] = [];
  for (const s of selects) {
    const v = get(s.key);
    if (v) chips.push({ key: s.key, label: `${s.label}: ${s.opts.find((o) => o.value === v)?.label ?? v}` });
  }
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });


  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {selects.map((s) => (
          <label key={s.key} className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            <Select value={get(s.key) || ALL} onValueChange={(v) => setParam(s.key, v)}>
              <SelectTrigger>
                {/* explicit label: Radix leaves SelectValue blank until hydration */}
                <SelectValue>{s.opts.find((o) => o.value === get(s.key))?.label ?? t("common.all")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")}</SelectItem>
                {s.opts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <SelectOptionRow label={o.label} token={o.token} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dates.period")}</span>
          <DateRangePicker from={get("from")} to={get("to")} onChange={setDates} />
        </label>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => setParam(c.key, null)} className="focus:outline-none">
              <Chip token="neutral" size="sm" className="gap-1 hover:bg-neutral-bg/70">
                {c.label}
                <X className="h-3 w-3" />
              </Chip>
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
            {t("orders.clearFilters")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
