import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { CONFIRMATION_STATUSES } from "@/lib/enums";
import { updateConfirmationStatus, logConfirmationAttempt } from "../actions";

type OrderRow = Tables<"orders"> & { product: { name: string } | null };
type CustomerStat = Tables<"customer_stats">;

function riskVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 60) return "destructive";
  if (score >= 30) return "secondary";
  return "default";
}

export async function ConfirmationRow({ order, stat }: { order: OrderRow; stat: CustomerStat | null }) {
  const t = await getTranslations();

  return (
    <div className="glass-card space-y-4 rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/app/orders/${order.id}`} className="font-medium hover:underline">
            {order.order_number ?? order.id.slice(0, 8)}
          </Link>
          <p className="text-sm text-muted-foreground">
            {order.product?.name ?? "—"} · {t("fields.quantity")}: {order.quantity} ·{" "}
            {formatCurrency((order.sale_price ?? 0) * order.quantity)}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.customer_name ?? "—"} · {order.customer_phone ?? "—"}
            {order.commune ? ` · ${order.commune}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(order.placed_at)}</p>
        </div>

        {stat ? (
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <Badge variant={riskVariant(stat.risk_score ?? 0)}>
              {t("fields.risk")}: {stat.risk_score ?? 0}
            </Badge>
            <span>
              {t("common.total")}: {stat.total_orders ?? 0} · {t("status.delivery_status.returned")}:{" "}
              {stat.returned_orders ?? 0} · {t("status.confirmation_status.cancelled")}: {stat.cancelled_orders ?? 0}
            </span>
          </div>
        ) : null}
      </div>

      {order.is_duplicate_suspect && order.duplicate_of ? (
        <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {t("orders.duplicateWarning")}{" "}
          <Link href={`/app/orders/${order.duplicate_of}`} className="underline">
            {t("orders.viewDuplicate")}
          </Link>
        </div>
      ) : null}

      <form action={updateConfirmationStatus.bind(null, order.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("fields.confirmation_status")} htmlFor={`status_${order.id}`}>
          <Select id={`status_${order.id}`} name="status" defaultValue={order.confirmation_status}>
            {CONFIRMATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.confirmation_status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.agent_comment")} htmlFor={`comment_${order.id}`} className="sm:col-span-2">
          <Textarea id={`comment_${order.id}`} name="comment" defaultValue={order.confirmation_comment ?? ""} />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-3">
          <Button type="submit" size="sm">
            {t("actions.save")}
          </Button>
          <Button type="submit" formAction={logConfirmationAttempt.bind(null, order.id)} variant="outline" size="sm">
            {t("orders.logAttempt")} ({order.confirmation_attempts})
          </Button>
        </div>
      </form>
    </div>
  );
}
