"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Tables } from "@/lib/supabase/database.types";
import type { Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { StatusPill } from "@/components/status-pill";
import { StatusSelect } from "@/components/status-select";
import { currentStatus } from "@/lib/statuses";
import { updateOrderStatus } from "./actions";
import { OrderTimeline } from "./order-timeline";

type OrderRow = Tables<"orders">;
type EventRow = Tables<"order_status_history">;

export function OrderWorkflow({
  order,
  role,
  events,
  actorNames,
}: {
  order: OrderRow;
  role: Role | null;
  events: EventRow[];
  actorNames: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = role === "admin" || role === "confirmation_agent";
  const canDeliver = role === "admin" || role === "delivery_agent";
  const status = currentStatus(order);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const comment = String(fd.get("agent_comment") ?? "").trim();
    const conf = String(fd.get("confirmation_status") ?? order.confirmation_status);
    const deliv = String(fd.get("delivery_status") ?? order.delivery_status);

    // One Save: apply each stage whose status changed (confirmation first —
    // delivery may depend on it). Comment-only edits go through the stage
    // this role can edit, same as the old per-stage button.
    const updates: { stage: "confirmation" | "delivery"; status: string }[] = [];
    if (canConfirm && conf !== order.confirmation_status) updates.push({ stage: "confirmation", status: conf });
    if (canDeliver && deliv !== order.delivery_status) updates.push({ stage: "delivery", status: deliv });
    if (!updates.length) updates.push(canConfirm ? { stage: "confirmation", status: conf } : { stage: "delivery", status: deliv });

    setBusy(true);
    setError(null);
    for (const u of updates) {
      const res = await updateOrderStatus({ orderId: order.id, ...u, comment });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="card-surface space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill kind={status.kind} status={status.key} />
        </div>

        {order.confirmation_comment ? (
          <p className="text-sm text-muted-foreground">{order.confirmation_comment}</p>
        ) : null}

        <h2 className="text-sm font-semibold">{t("orders.workflow")}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {canConfirm ? (
            <Field label={t("fields.confirmation_status")}>
              <StatusSelect kind="confirmation" name="confirmation_status" value={order.confirmation_status} />
            </Field>
          ) : null}
          {canDeliver ? (
            <Field label={t("fields.delivery_status")}>
              <StatusSelect kind="delivery" name="delivery_status" value={order.delivery_status} />
            </Field>
          ) : null}
        </div>

        <Field label={t("fields.agent_comment")} htmlFor="agent_comment" hint={t("common.optional")}>
          <Textarea
            id="agent_comment"
            name="agent_comment"
            defaultValue={order.confirmation_comment ?? ""}
          />
        </Field>

        {error ? (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        {canConfirm || canDeliver ? (
          <Button type="submit" disabled={busy}>
            {busy ? t("actions.saving") : t("actions.save")}
          </Button>
        ) : null}
      </form>

      <div className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("orders.history")}</h2>
        <OrderTimeline events={events} actorNames={actorNames} />
      </div>
    </div>
  );
}
