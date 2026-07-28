"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { pushOrderToZRExpress, refreshZRShipmentStatus } from "../actions";

export function ZRShipmentCard({
  orderId,
  shipment,
}: {
  orderId: string;
  shipment: { trackingNumber: string | null; state: string | null; stateUpdatedAt: string | null } | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action(orderId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? null);
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
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={() => run(pushOrderToZRExpress)}>
          {busy ? t("actions.saving") : t("orders.zrexpress.send")}
        </Button>
      )}

      {error ? <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
