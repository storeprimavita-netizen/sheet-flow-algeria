"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listZRHubs, pushOrderToZRExpress, refreshZRShipmentStatus, switchOrderToHome } from "../actions";

export function ZRShipmentCard({
  orderId,
  shipment,
  stopDesk,
  canSwitchToHome,
}: {
  orderId: string;
  shipment: { trackingNumber: string | null; state: string | null; stateUpdatedAt: string | null } | null;
  /** stop-desk order → parcel goes to a ZR hub (pickup point) */
  stopDesk: boolean;
  /** stop-desk order in a wilaya that is now home-only: admin may switch it to home */
  canSwitchToHome: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hubs, setHubs] = useState<{ id: string; name: string | null }[] | null>(null);
  const [hubId, setHubId] = useState<string>("");

  async function loadHubs() {
    setBusy(true);
    setError(null);
    const res = await listZRHubs(orderId);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setHubs(res.hubs);
    if (res.hubs.length === 1) setHubId(res.hubs[0].id);
  }

  async function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action(orderId);
    setBusy(false);
    if (!res.ok) {
      // switchOrderToHome returns message keys; ZR errors are plain text from the carrier
      setError(res.error?.startsWith("orders.zrexpress.switch.") ? t(res.error) : (res.error ?? null));
      return;
    }
    router.refresh();
  }

  return (
    <div className="card-surface space-y-3 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4" />
        {t("orders.zrexpress.title")}
      </h2>

      {shipment ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("orders.zrexpress.tracking")}:</span>
            {shipment.trackingNumber ? (
              <>
                <code className="num rounded-md border border-input bg-muted/30 px-2 py-0.5 text-xs">
                  {shipment.trackingNumber}
                </code>
                <CopyButton text={shipment.trackingNumber} />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t("orders.zrexpress.pendingTracking")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("orders.zrexpress.state")}:</span>
            <Badge variant={shipment.state ? "default" : "outline"}>
              {shipment.state ?? t("orders.zrexpress.stateUnknown")}
            </Badge>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run(refreshZRShipmentStatus)}>
            {busy ? t("actions.saving") : t("orders.zrexpress.refresh")}
          </Button>
        </div>
      ) : stopDesk && !hubs ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={loadHubs}>
          {t("settings.zrexpress.loadHubs")}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {stopDesk && hubs ? (
            <Select value={hubId} onValueChange={setHubId}>
              <SelectTrigger className="w-64" aria-label={t("settings.zrexpress.pickHub")}>
                <SelectValue placeholder={t("settings.zrexpress.pickHub")} />
              </SelectTrigger>
              <SelectContent>
                {hubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name ?? h.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || (stopDesk && !hubId)}
            onClick={() => run((id) => pushOrderToZRExpress(id, stopDesk ? hubId : null))}
          >
            {busy ? t("actions.saving") : t("orders.zrexpress.send")}
          </Button>
        </div>
      )}

      {canSwitchToHome && !shipment ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">{t("orders.zrexpress.stopdeskGone")}</p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run(switchOrderToHome)}>
            {t("orders.zrexpress.switchToHome")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
