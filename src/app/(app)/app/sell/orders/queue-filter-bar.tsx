"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { SearchParamInput, type SearchBoxHandle } from "@/components/fields/search-param-input";
import { CLEARED, serializePresentation, type ViewPresentation, type ViewScope } from "@/lib/order-views";
import { ViewPresentationControls } from "./view-presentation-controls";

export type QueueStatusOpt = { value: string; label: string };

/** Minimal filter bar for the confirmation / delivery queues: search + one status. Lets a view be built from the UI. */
export function QueueFilterBar({
  statusKey,
  statusLabel,
  statusOptions,
  q,
  status,
  viewKeys,
  scope,
  presentation,
  isAdmin,
}: {
  statusKey: "confirmation_status" | "delivery_status";
  statusLabel: string;
  statusOptions: QueueStatusOpt[];
  /** effective values (view merged with the URL) */
  q: string;
  status: string;
  viewKeys: string[];
  scope: ViewScope;
  presentation: ViewPresentation;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const box = React.useRef<SearchBoxHandle>(null);

  function setStatus(v: string) {
    const next = new URLSearchParams(sp.toString());
    if (v === CLEARED) {
      if (viewKeys.includes(statusKey)) next.set(statusKey, CLEARED);
      else next.delete(statusKey);
    } else next.set(statusKey, v);
    next.delete("page");
    box.current?.mergeInto(next);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const selected = statusOptions.find((o) => o.value === status);
  function changePresentation(value: ViewPresentation) {
    const next = serializePresentation(new URLSearchParams(sp.toString()), value);
    if (scope === "shipping" && next.get("view") === "kanban") next.delete("view");
    box.current?.mergeInto(next);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <SearchParamInput placeholder={t("orders.search")} inherited={q} clearedMarker={CLEARED} syncRef={box} />
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
      <ViewPresentationControls scope={scope} isAdmin={isAdmin} presentation={presentation} onChange={changePresentation} />
    </div>
  );
}
