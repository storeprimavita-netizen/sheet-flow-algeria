"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { SearchParamInput } from "@/components/fields/search-param-input";
import { CLEARED } from "@/lib/order-views";

export type QueueStatusOpt = { value: string; label: string };

/** Minimal filter bar for the confirmation / delivery queues: search + one status. Lets a view be built from the UI. */
export function QueueFilterBar({
  statusKey,
  statusLabel,
  statusOptions,
  q,
  status,
  viewKeys,
}: {
  statusKey: "confirmation_status" | "delivery_status";
  statusLabel: string;
  statusOptions: QueueStatusOpt[];
  /** effective values (view merged with the URL) */
  q: string;
  status: string;
  viewKeys: string[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setStatus(v: string) {
    const next = new URLSearchParams(sp.toString());
    if (v === CLEARED) {
      if (viewKeys.includes(statusKey)) next.set(statusKey, CLEARED);
      else next.delete(statusKey);
    } else next.set(statusKey, v);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const selected = statusOptions.find((o) => o.value === status);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <SearchParamInput placeholder={t("orders.search")} inherited={q} clearedMarker={CLEARED} />
      </div>
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{statusLabel}</span>
        <Select value={status || CLEARED} onValueChange={setStatus}>
          <SelectTrigger className="min-w-44">
            <SelectValue>{selected?.label ?? (status ? status.split(",").map((s) => statusOptions.find((o) => o.value === s)?.label ?? s).join(", ") : t("common.all"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CLEARED}>{t("common.all")}</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
