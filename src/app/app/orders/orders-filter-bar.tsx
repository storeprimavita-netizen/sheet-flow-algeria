"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/fields/date-field";
import { Chip } from "@/components/ui/chip";
import { CONFIRMATION_STATUSES, DELIVERY_STATUSES, ORDER_SOURCES } from "@/lib/enums";

export type Opt = { value: string; label: string };

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row

/** Filters that live in the URL and drive the All-orders server query. */
export function OrdersFilterBar({
  products,
  wilayas,
  agents,
}: {
  products: Opt[];
  wilayas: Opt[];
  agents: Opt[];
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
    next.delete("page"); // any filter change resets pagination
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const confOpts: Opt[] = CONFIRMATION_STATUSES.map((s) => ({ value: s, label: t(`status.confirmation_status.${s}`) }));
  const delivOpts: Opt[] = DELIVERY_STATUSES.map((s) => ({ value: s, label: t(`status.delivery_status.${s}`) }));
  const sourceOpts: Opt[] = ORDER_SOURCES.map((s) => ({ value: s, label: t(`status.order_source.${s}`) }));

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
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${get("from")}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${get("to")}` });
  if (dupOn) chips.push({ key: "duplicates", label: t("orders.duplicatesOnly") });

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
              <button key={c.key} type="button" onClick={() => setParam(c.key, null)} className="focus:outline-none">
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
    </div>
  );
}
