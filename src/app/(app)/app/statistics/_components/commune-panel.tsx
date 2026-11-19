import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { asCommuneStats, type GroupExtras } from "@/lib/kpi";
import { drillQs, type DashboardFilters } from "@/lib/query-string";
import { tableClass } from "@/components/field";
import { RetryButton } from "@/components/dashboard/band-retry";
import { CountLink, GroupExtrasLine, RateStat } from "@/components/stats/rate-stat";

/**
 * The open wilaya: its extras (avg days, home / stop desk) and one row per
 * commune from SQL `kpi_by_commune`. Own Suspense + inline error, so a failing
 * commune query never takes down the wilaya table.
 */
export async function CommunePanel({
  wilaya,
  wilayaLabel,
  extras,
  filters,
}: {
  wilaya: number;
  wilayaLabel: string;
  extras: GroupExtras;
  filters: DashboardFilters;
}) {
  const t = await getTranslations("statistics");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_by_commune", {
    p_wilaya: wilaya,
    p_from: filters.from,
    p_to: filters.to,
    p_product: filters.product ? [filters.product] : undefined,
  });

  if (error) {
    console.error("statistics/communes", error.message);
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <span>{t("communeError")}</span>
        <RetryButton label={t("retry")} />
      </div>
    );
  }

  const communes = asCommuneStats(data);
  const link = (kind: "received" | "confirmed" | "delivered" | "returned", key: string | null) =>
    drillQs(filters, { kind, wilaya, communeKey: key });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t("communeTitle", { wilaya: wilayaLabel })}</h3>
      <GroupExtrasLine
        extras={extras}
        homeHref={drillQs(filters, { kind: "shipped", wilaya, deliveryType: "home" })}
        stopdeskHref={drillQs(filters, { kind: "shipped", wilaya, deliveryType: "stopdesk" })}
      />
      {communes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("communeEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`${tableClass} min-w-[36rem]`}>
            <thead>
              <tr>
                <th>{t("commune")}</th>
                <th className="text-end">{t("received")}</th>
                <th>{t("confirmation")}</th>
                <th>{t("delivery")}</th>
                <th>{t("return")}</th>
              </tr>
            </thead>
            <tbody>
              {communes.map((c) => (
                <tr key={c.key ?? "unknown"}>
                  <td>
                    <Link href={link("received", c.key)} className="hover:underline">
                      <bdi>{c.name ?? t("unknownCommune")}</bdi>
                    </Link>
                  </td>
                  <td className="text-end">
                    <CountLink n={c.rates.counts.received} href={link("received", c.key)} />
                  </td>
                  <td className="min-w-36"><RateStat metric={c.rates.confirmation} href={link("confirmed", c.key)} /></td>
                  <td className="min-w-36"><RateStat metric={c.rates.delivery} href={link("delivered", c.key)} /></td>
                  <td className="min-w-36"><RateStat metric={c.rates.return} href={link("returned", c.key)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
