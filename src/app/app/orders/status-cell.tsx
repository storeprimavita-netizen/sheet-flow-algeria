"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusSelect } from "@/components/status-select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { currentStatus } from "@/lib/statuses";
import { updateOrderStatus } from "./actions";
import { OrderTimeline, type TimelineEvent } from "./order-timeline";

/**
 * The one collapsed Status cell (Phase 14a): delivery_status once confirmed,
 * else confirmation_status (`currentStatus()`). A history icon opens the same
 * `order_status_history` timeline in a popover; status changes inline via the
 * role-scoped `<StatusSelect>` without leaving the page — the RPC still
 * enforces who may set what. Only used from admin-only order views.
 */
export function StatusCell({
  orderId,
  order,
  events,
  actorNames,
}: {
  orderId: string;
  order: { confirmation_status: string; delivery_status: string };
  events: TimelineEvent[];
  actorNames: Record<string, string>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { kind, key } = currentStatus(order);

  async function onChange(status: string) {
    const res = await updateOrderStatus({ orderId, stage: kind, status, comment: "" });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("common.updated"));
    router.refresh();
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1">
      <StatusSelect kind={kind} value={key} onChange={onChange} compact className="w-auto min-w-[7rem]" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("orders.history")} title={t("orders.history")}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="max-h-80 overflow-y-auto">
          <OrderTimeline events={events} actorNames={actorNames} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
