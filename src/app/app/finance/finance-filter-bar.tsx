"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/fields/date-field";
import { Chip } from "@/components/ui/chip";
import { EXPENSE_CATEGORIES, AD_KINDS } from "@/lib/enums";

type Opt = { value: string; label: string };

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row

/** Builds a `?from=&to=&...` query string, carrying the current date range into a drill-through link. */
export function financeQs(dateRange: { from?: string; to?: string }, extra: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return `?${params.toString()}`;
}

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

  const get = (k: string) => sp.get(k) ?? "";

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v || v === ALL) next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const categoryOpts: Opt[] = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`status.expense_category.${c}`) }));
  const kindOpts: Opt[] = AD_KINDS.map((k) => ({ value: k, label: t(`status.ad_kind.${k}`) }));

  const selects: { key: string; label: string; opts: Opt[] }[] = [
    ...(showProduct ? [{ key: "product", label: t("fields.product"), opts: products }] : []),
    ...(showCategory ? [{ key: "category", label: t("fields.category"), opts: categoryOpts }] : []),
    ...(showKind ? [{ key: "kind", label: t("fields.kind"), opts: kindOpts }] : []),
  ];

  const chips: { key: string; label: string }[] = [];
  for (const s of selects) {
    const v = get(s.key);
    if (v) chips.push({ key: s.key, label: `${s.label}: ${s.opts.find((o) => o.value === v)?.label ?? v}` });
  }
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${get("from")}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${get("to")}` });

  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const presets: { label: string; range: [string, string] }[] = [
    { label: t("dashboard.filters.today"), range: [today, today] },
    { label: t("dashboard.filters.last7"), range: [daysAgo(6), today] },
    { label: t("dashboard.filters.last30"), range: [daysAgo(29), today] },
  ];

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.set("from", p.range[0]);
              next.set("to", p.range[1]);
              router.push(`${pathname}?${next.toString()}`, { scroll: false });
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {selects.map((s) => (
          <label key={s.key} className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            <Select value={get(s.key) || ALL} onValueChange={(v) => setParam(s.key, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")}</SelectItem>
                {s.opts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.from")}</span>
          <DateField value={get("from")} onChange={(v) => setParam("from", v)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.to")}</span>
          <DateField value={get("to")} onChange={(v) => setParam("to", v)} />
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
