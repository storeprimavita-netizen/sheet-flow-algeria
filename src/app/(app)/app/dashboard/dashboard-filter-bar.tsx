"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/fields/date-field";
import { formatDate } from "@/lib/format";
import { DASHBOARD_PERSIST_KEYS, pickParams } from "@/lib/query-string";
import { Chip } from "@/components/ui/chip";
import { SelectOptionRow } from "@/components/fields/select-option-row";
import type { StatusToken } from "@/lib/statuses";

export type Opt = { value: string; label: string; token?: StatusToken };

const ALL = "__all"; // Radix Select needs a non-empty sentinel for the "All" row
const STORAGE_KEY = "mnw:dashboardFilters";

/**
 * Sticky, URL-persisted dashboard filter bar (date range · product). Remembers the last-used
 * filters per browser (localStorage) and restores them on a bare
 * `/app/dashboard` visit — same URL-param shape `page.tsx` reads server-side.
 */
export function DashboardFilterBar({ products }: { products: Opt[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const restored = React.useRef(false);

  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (sp.toString()) return; // explicit URL wins over the remembered one
    const saved = pickParams(localStorage.getItem(STORAGE_KEY) ?? "", DASHBOARD_PERSIST_KEYS); // own keys only
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

  const selects: { key: string; label: string; opts: Opt[] }[] = [{ key: "product", label: t("fields.product"), opts: products }];

  const chips: { key: string; label: string }[] = [];
  for (const s of selects) {
    const v = get(s.key);
    const label = s.opts.find((o) => o.value === v)?.label;
    if (v && label) chips.push({ key: s.key, label: `${s.label}: ${label}` }); // unknown ids show no chip
  }
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });


  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="card-surface z-10 sm:sticky sm:top-0 w-full space-y-3 rounded-xl p-3 backdrop-blur sm:w-fit">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[16rem_14rem]">
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
