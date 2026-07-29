"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/fields/date-field";
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

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v) next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const presets: { label: string; range: [string, string] }[] = [
    { label: t("dashboard.filters.today"), range: [today, today] },
    { label: t("dashboard.filters.last7"), range: [daysAgo(6), today] },
    { label: t("dashboard.filters.last30"), range: [daysAgo(29), today] },
  ];

  const chips: { key: string; label: string }[] = [];
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${get("from")}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${get("to")}` });

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="flex flex-wrap items-end gap-3">
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
