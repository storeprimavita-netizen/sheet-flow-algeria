"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Tables } from "@/lib/supabase/database.types";
import type { Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { CONFIRMATION_STATUSES, DELIVERY_STATUSES } from "@/lib/enums";
import { updateOrderStatus } from "./actions";

type OrderRow = Tables<"orders">;
type EventRow = Tables<"order_events">;

export function OrderWorkflow({
  order,
  role,
  events,
}: {
  order: OrderRow;
  role: Role | null;
  events: EventRow[];
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
      orderNumber: order.order_number,
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
      <form onSubmit={onSubmit} className="glass-card space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t("fields.confirmation_status")}: {t(`status.confirmation_status.${order.confirmation_status}`)}
          </Badge>
          <Badge variant="secondary">
            {t("fields.delivery_status")}: {t(`status.delivery_status.${order.delivery_status}`)}
          </Badge>
        </div>

        {order.agent_comment ? (
          <p className="text-sm text-muted-foreground">{order.agent_comment}</p>
        ) : null}

        <h2 className="text-sm font-semibold">{t("orders.workflow")}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {canConfirm ? (
            <Field label={t("fields.confirmation_status")} htmlFor="confirmation_status">
              <Select
                id="confirmation_status"
                name="confirmation_status"
                defaultValue={order.confirmation_status}
              >
                {CONFIRMATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.confirmation_status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {canDeliver ? (
            <Field label={t("fields.delivery_status")} htmlFor="delivery_status">
              <Select id="delivery_status" name="delivery_status" defaultValue={order.delivery_status}>
                {DELIVERY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.delivery_status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <Field label={t("fields.agent_comment")} htmlFor="agent_comment" hint={t("common.optional")}>
          <Textarea id="agent_comment" name="agent_comment" defaultValue={order.agent_comment ?? ""} />
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

      <div className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("orders.history")}</h2>
        {!events.length ? (
          <p className="text-sm text-muted-foreground">{t("orders.eventsNone")}</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-col gap-1 border-s-2 border-border ps-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {ev.stage === "confirmation"
                      ? t("fields.confirmation_status")
                      : t("fields.delivery_status")}
                  </Badge>
                  <span className="font-medium">
                    {ev.stage === "confirmation"
                      ? t(`status.confirmation_status.${ev.status}`)
                      : t(`status.delivery_status.${ev.status}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(ev.created_at)}
                  </span>
                </div>
                {ev.comment ? <p className="text-muted-foreground">{ev.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
