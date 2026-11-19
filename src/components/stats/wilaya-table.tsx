"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { drillQs, type DashboardFilters } from "@/lib/query-string";
import type { WilayaStat } from "@/lib/kpi";
import { tableClass } from "@/components/field";
import { CountLink, RateStat } from "@/components/stats/rate-stat";

export type WilayaTableRow = WilayaStat & { label: string };

/**
 * Per-wilaya table. Every count links to the orders behind it (SQL
 * `kpi_drill_orders`, same set as the numbers). The first cell holds an expand
 * link (`?wilaya=`) apart from the wilaya's own drill link; `panel` is the
 * server-rendered commune panel of the one open wilaya. First column is sticky
 * so the four rates stay readable at 390px.
 */
export function WilayaTable({
  rows,
  filters,
  expanded,
  panel,
  hovered,
  onHover,
}: {
  rows: WilayaTableRow[];
  filters: DashboardFilters;
  expanded: number | null;
  panel: React.ReactNode;
  hovered: number | null;
  onHover: (code: number | null) => void;
}) {
  const t = useTranslations("statistics");
  const toggleHref = (code: number) => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.product) p.set("product", filters.product);
    if (expanded !== code) p.set("wilaya", String(code));
    const qs = p.toString();
    return `/app/statistics${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className={cn(tableClass, "min-w-[40rem]")}>
        <thead>
          <tr>
            <th className="sticky start-0 z-[1] bg-surface">{t("wilayaTitle")}</th>
            <th className="text-end">{t("received")}</th>
            <th>{t("confirmation")}</th>
            <th>{t("delivery")}</th>
            <th>{t("return")}</th>
          </tr>
        </thead>
        {rows.map((w) => {
          const code = w.code;
          const open = code !== null && expanded === code;
          const link = (kind: Parameters<typeof drillQs>[1]["kind"]) =>
            code === null ? undefined : drillQs(filters, { kind, wilaya: code });
          const panelId = `wilaya-panel-${code}`;
          return (
            <tbody key={code ?? "unknown"}>
              <tr
                className={cn("bg-surface transition-colors", code !== null && hovered === code && "bg-surface-raised")}
                onMouseEnter={() => onHover(code)}
                onMouseLeave={() => onHover(null)}
              >
                <td className="sticky start-0 z-[1] bg-inherit">
                  <div className="flex items-center gap-1">
                    {code === null ? (
                      <span className="inline-block w-7" />
                    ) : (
                      <Link
                        href={toggleHref(code)}
                        scroll={false}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={`${open ? t("collapse") : t("expand")}: ${w.label}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />}
                      </Link>
                    )}
                    {code === null ? (
                      <span className="whitespace-nowrap">{w.label}</span>
                    ) : (
                      <Link href={drillQs(filters, { kind: "received", wilaya: code })} className="whitespace-nowrap hover:underline">
                        <bdi dir="ltr">{code}</bdi>
                        <span> · </span>
                        <bdi>{w.label}</bdi>
                      </Link>
                    )}
                  </div>
                </td>
                <td className="text-end">
                  <CountLink n={w.rates.counts.received} href={link("received")} />
                </td>
                <td className="min-w-36">
                  <RateStat metric={w.rates.confirmation} href={link("confirmed")} />
                </td>
                <td className="min-w-36">
                  <RateStat metric={w.rates.delivery} href={link("delivered")} />
                </td>
                <td className="min-w-36">
                  <RateStat metric={w.rates.return} href={link("returned")} />
                </td>
              </tr>
              {open ? (
                <tr id={panelId} className="bg-surface-raised/40">
                  <td colSpan={5} className="!p-0">
                    <div className="sticky start-0 w-[calc(100vw-4rem)] max-w-full p-4">{panel}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
