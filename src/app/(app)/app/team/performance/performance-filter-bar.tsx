"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/fields/date-field";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/chip";

/** Date-range filter — all-time by default (matches `agent_performance`'s own
 * scope); a from/to narrows to a raw order_status_history aggregation
 * (page.tsx), same numbers, just windowed. */
export function PerformanceFilterBar() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";

  function setDates(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of [["from", from], ["to", to]] as const) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v) next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }


  const chips: { key: string; label: string }[] = [];
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dates.period")}</span>
          <DateRangePicker from={get("from")} to={get("to")} onChange={setDates} className="min-w-52" />
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
