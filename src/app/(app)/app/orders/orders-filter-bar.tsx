"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/fields/date-field";
import { formatDate } from "@/lib/format";
import { DRILL_PARAMS } from "@/lib/query-string";
import { Chip } from "@/components/ui/chip";
import { SelectOptionRow } from "@/components/fields/select-option-row";
import { CONFIRMATION_STATUSES, DELIVERY_STATUSES, ORDER_SOURCES } from "@/lib/enums";
import { drillChips, type DrillFilters, type DrillKey } from "./_lib/drill-filters";
import { getStatus, ORDER_SOURCE_TOKEN, type StatusToken } from "@/lib/statuses";

export type Opt = { value: string; label: string; token?: StatusToken };

/** Statistics-only filters read by orders/all (with or without a drill metric). */
export const DRILL_FILTER_KEYS = ["category", "conf_agent", "delivery_type"] as const;

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row

/** Filters that live in the URL and drive the All-orders server query. */
export function OrdersFilterBar({
  products,
  wilayas,
  agents,
  categories,
  drill,
  dropped,
}: {
  products: Opt[];
  wilayas: Opt[];
  agents: Opt[];
  categories: Opt[];
  /** Statistics-only filters, already checked by the page. */
  drill: DrillFilters;
  dropped: DrillKey[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const get = (k: string) => sp.get(k) ?? "";

  /** Any other filter change leaves statistics drill mode (drill ids would otherwise override it). */
  function leaveDrill(next: URLSearchParams) {
    for (const k of [...DRILL_PARAMS, ...DRILL_FILTER_KEYS]) next.delete(k);
  }

  function setDates(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of [["from", from], ["to", to]] as const) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    leaveDrill(next);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v || v === ALL) next.delete(k);
    else next.set(k, v);
    leaveDrill(next);
    next.delete("page"); // any filter change resets pagination
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const DRILL_KEYS = new Set<string>(DRILL_FILTER_KEYS);
  function dropOne(k: string) {
    const next = new URLSearchParams(sp.toString());
    next.delete(k);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const confOpts: Opt[] = CONFIRMATION_STATUSES.map((s) => ({
    value: s,
    label: t(`status.confirmation_status.${s}`),
    token: getStatus("confirmation", s)?.token,
  }));
  const delivOpts: Opt[] = DELIVERY_STATUSES.map((s) => ({
    value: s,
    label: t(`status.delivery_status.${s}`),
    token: getStatus("delivery", s)?.token,
  }));
  const sourceOpts: Opt[] = ORDER_SOURCES.map((s) => ({
    value: s,
    label: t(`status.order_source.${s}`),
    token: ORDER_SOURCE_TOKEN[s],
  }));

  const selects: { key: string; label: string; opts: Opt[] }[] = [
    { key: "confirmation_status", label: t("fields.confirmation_status"), opts: confOpts },
    { key: "delivery_status", label: t("fields.delivery_status"), opts: delivOpts },
    { key: "product_id", label: t("fields.product"), opts: products },
    { key: "wilaya_code", label: t("fields.wilaya"), opts: wilayas },
    { key: "source", label: t("fields.source"), opts: sourceOpts },
    { key: "agent", label: t("fields.agent"), opts: agents },
  ];

  const dupOn = get("duplicates") === "1";

  // active-filter chips
  const chips: { key: string; label: string }[] = [];
  for (const s of selects) {
    const v = get(s.key);
    if (v) chips.push({ key: s.key, label: `${s.label}: ${s.opts.find((o) => o.value === v)?.label ?? v}` });
  }
  // statistics-only filters that orders/all applies: always visible, removable one by one
  chips.push(
    ...drillChips(drill, {
      category: t("fields.category"),
      agent: t("fields.agent"),
      deliveryType: t("statistics.filters.deliveryType"),
      selected: t("statistics.compare.selected"),
      deliveryTypeNames: { home: t("statistics.home"), stopdesk: t("statistics.stopdesk") },
      categories,
      agents,
    }),
  );
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });
  if (get("q")) chips.push({ key: "q", label: `${t("orders.search")}: ${get("q")}` });
  if (dupOn) chips.push({ key: "duplicates", label: t("orders.duplicatesOnly") });

  const droppedNames: Record<DrillKey, string> = {
    category: t("fields.category"),
    conf_agent: t("fields.agent"),
    delivery_type: t("statistics.filters.deliveryType"),
  };

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={dupOn ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setParam("duplicates", dupOn ? null : "1")}
        >
          <Copy className="h-3.5 w-3.5" />
          {t("orders.duplicatesOnly")}
        </Button>

        {chips.length > 0 ? (
          <>
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => (DRILL_KEYS.has(c.key) ? dropOne(c.key) : setParam(c.key, null))} className="focus:outline-none">
                <Chip token="neutral" size="sm" className="gap-1 hover:bg-neutral-bg/70">
                  {c.label}
                  <X className="h-3 w-3" />
                </Chip>
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push(pathname, { scroll: false })}
            >
              {t("orders.clearFilters")}
            </Button>
          </>
        ) : null}
      </div>
      {dropped.length > 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          {dropped.map((k) => t("statistics.filters.dropped", { name: droppedNames[k] })).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
