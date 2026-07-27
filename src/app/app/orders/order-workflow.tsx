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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const stage = String(fd.get("stage") ?? "");
    if (stage !== "confirmation" && stage !== "delivery") return;

    setBusy(true);
    setError(null);

    const comment = String(fd.get("agent_comment") ?? "").trim();
    const status =
      stage === "confirmation"
        ? String(fd.get("confirmation_status") ?? "")
        : String(fd.get("delivery_status") ?? "");

    const res = await updateOrderStatus({
      orderId: order.id,
      stage,
      status,
      comment,
    });

    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="card-surface space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill kind="confirmation" status={order.confirmation_status} />
          <StatusPill kind="delivery" status={order.delivery_status} />
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

        <div className="flex flex-wrap items-center gap-2">
          {canConfirm ? (
            <Button type="submit" name="stage" value="confirmation" disabled={busy}>
              {t("actions.save")}
            </Button>
          ) : null}
          {canDeliver ? (
            <Button type="submit" name="stage" value="delivery" disabled={busy}>
              {t("actions.save")}
            </Button>
          ) : null}
        </div>
      </form>

      <div className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("orders.history")}</h2>
        <OrderTimeline events={events} actorNames={actorNames} />
      </div>
    </div>
  );
}
