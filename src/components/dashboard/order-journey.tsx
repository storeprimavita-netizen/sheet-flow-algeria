import { getTranslations } from "next-intl/server";

import type { Kpi } from "@/lib/kpi";
import { Funnel } from "@/components/stats/funnel";
import { Band, BandError } from "./band";

/**
 * Band 3 — Received → Confirmed → On road → Delivered from `kpi.counts`, drop-off between
 * stages drawn by the shared Funnel. "Collected by ZR" and "Paid out" wait for ZR-4 / MONEY-1.
 */
export async function OrderJourney({
  kpi,
  hrefs,
  retryHref,
}: {
  kpi: Kpi | null;
  hrefs: { received: string; confirmed: string; onRoad: string; delivered: string };
  retryHref: string;
}) {
  const t = await getTranslations("dashboard.v2.journey");
  return (
    <Band id="band-journey" title={t("title")}>
      <div className="card-surface space-y-4 rounded-xl p-5">
        {!kpi ? (
          <BandError retryHref={retryHref} />
        ) : (
          <>
            <Funnel
              stages={[
                { label: t("received"), count: kpi.counts.received, href: hrefs.received },
                { label: t("confirmed"), count: kpi.counts.confirmed, href: hrefs.confirmed },
                { label: t("onRoad"), count: kpi.counts.on_road_orders, href: hrefs.onRoad, dropFrom: -1 },
                { label: t("delivered"), count: kpi.counts.delivered, href: hrefs.delivered, dropFrom: 1 },
              ]}
            />
            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              {(["collected", "paidOut"] as const).map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">{t(k)}</dt>
                  <dd className="text-end">
                    <span className="num font-medium">—</span>
                    <span className="block text-xs text-muted-foreground">{t(`${k}Hint`)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Band>
  );
}
