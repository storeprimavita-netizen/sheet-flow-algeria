import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { DELIVERY_STATUSES } from "@/lib/enums";
import { updateDeliveryStatus } from "../actions";

type OrderRow = Tables<"orders"> & { product: { name: string } | null; wilaya: { name: string } | null };

export async function DeliveryRow({ order }: { order: OrderRow }) {
  const t = await getTranslations();

  return (
    <div className="card-surface space-y-4 rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/app/orders/${order.id}`} className="font-medium hover:underline">
            {order.order_number ?? order.id.slice(0, 8)}
          </Link>
          <p className="text-sm text-muted-foreground">
            {order.product?.name ?? "—"} · {t("fields.quantity")}: {order.quantity} ·{" "}
            {formatCurrency(order.delivery_fee ?? 0)} {t("fields.delivery_fee")}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.customer_name ?? "—"} · {order.customer_phone ?? "—"}
            {order.commune ? ` · ${order.commune}` : ""}
            {order.wilaya?.name ? ` · ${order.wilaya.name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(`status.delivery_type.${order.delivery_type}`)} · {formatDateTime(order.placed_at)}
          </p>
        </div>
        <Badge variant={order.delivery_status === "delivered" ? "default" : "secondary"}>
          {t(`status.delivery_status.${order.delivery_status}`)}
        </Badge>
      </div>

      <form action={updateDeliveryStatus.bind(null, order.id)} className="flex flex-wrap items-end gap-3">
        <Field label={t("fields.delivery_status")} htmlFor={`delivery_status_${order.id}`}>
          <Select id={`delivery_status_${order.id}`} name="status" defaultValue={order.delivery_status}>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.delivery_status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="sm">
          {t("actions.save")}
        </Button>
      </form>
    </div>
  );
}
