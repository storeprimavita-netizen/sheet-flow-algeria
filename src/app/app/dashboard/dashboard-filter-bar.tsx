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
import { CONFIRMATION_STATUSES, DELIVERY_STATUSES, ORDER_SOURCES } from "@/lib/enums";
import { getStatus, ORDER_SOURCE_TOKEN, type StatusToken } from "@/lib/statuses";

export type Opt = { value: string; label: string; token?: StatusToken };

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row
const STORAGE_KEY = "mnw:dashboardFilters";

/**
 * Sticky, URL-persisted dashboard filter bar (date range · product · wilaya ·
 * source · agent · confirmation/delivery status). Remembers the last-used
 * filters per browser (localStorage) and restores them on a bare
 * `/app/dashboard` visit — same URL-param shape `page.tsx` reads server-side.
 */
export function DashboardFilterBar({ products, wilayas, agents }: { products: Opt[]; wilayas: Opt[]; agents: Opt[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const restored = React.useRef(false);

  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (sp.toString()) return; // explicit URL wins over the remembered one
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const get = (k: string) => sp.get(k) ?? "";

  function setDates(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of [["from", from], ["to", to]] as const) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
        localStorage.setItem(STORAGE_KEY, next.toString());
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v || v === ALL) next.delete(k);
    else next.set(k, v);
    localStorage.setItem(STORAGE_KEY, next.toString());
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
    { key: "product", label: t("fields.product"), opts: products },
    { key: "wilaya", label: t("fields.wilaya"), opts: wilayas },
    { key: "source", label: t("fields.source"), opts: sourceOpts },
    { key: "agent", label: t("fields.agent"), opts: agents },
    { key: "confirmation_status", label: t("fields.confirmation_status"), opts: confOpts },
    { key: "delivery_status", label: t("fields.delivery_status"), opts: delivOpts },
  ];

  const chips: { key: string; label: string }[] = [];
  for (const s of selects) {
    const v = get(s.key);
    if (v) chips.push({ key: s.key, label: `${s.label}: ${s.opts.find((o) => o.value === v)?.label ?? v}` });
  }
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });


  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="card-surface sticky top-0 z-10 space-y-3 rounded-xl p-4 backdrop-blur">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dates.period")}</span>
          <DateRangePicker from={get("from")} to={get("to")} onChange={setDates} />
        </label>
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
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            {t("orders.clearFilters")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
