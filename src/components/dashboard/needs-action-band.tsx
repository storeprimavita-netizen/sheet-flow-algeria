import { getTranslations } from "next-intl/server";
import { PhoneCall, RotateCcw, TimerOff, Truck } from "lucide-react";

import { RETRY_CONFIRMATION, STUCK_DAYS } from "@/lib/statuses";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Band, BandError } from "./band";

export type NeedsActionCounts = { toConfirm: number; toShip: number; toRetry: number; stuck: number };

/**
 * Band 1 — what needs a human right now. Fixed (ignores the period filter).
 * Standalone on purpose: the agent home (NAV-5) reuses it.
 */
export async function NeedsActionBand({ counts }: { counts: NeedsActionCounts | null }) {
  const t = await getTranslations("dashboard.v2.needsAction");
  return (
    <Band id="band-needs-action" title={t("title")} note={t("notFiltered")}>
      {!counts ? (
        <BandError />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile icon={PhoneCall} label={t("toConfirm")} value={String(counts.toConfirm)} hint={t("toConfirmHint")} href="/app/sell/confirmation" />
          <KpiTile icon={Truck} label={t("toShip")} value={String(counts.toShip)} hint={t("toShipHint")} href="/app/sell/shipping" />
          <KpiTile
            icon={RotateCcw}
            label={t("toRetry")}
            value={String(counts.toRetry)}
            hint={t("toRetryHint")}
            href={`/app/sell/orders?confirmation_status=${RETRY_CONFIRMATION.join(",")}`}
          />
          <KpiTile
            icon={TimerOff}
            label={t("stuck")}
            value={String(counts.stuck)}
            tone={counts.stuck > 0 ? "danger" : undefined}
            sub={t("stuckSub", { days: STUCK_DAYS })}
            hint={t("stuckHint")}
            href="/app/sell/shipping"
          />
        </div>
      )}
    </Band>
  );
}
