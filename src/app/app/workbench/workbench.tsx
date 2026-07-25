"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  X,
  Phone,
  PhoneOff,
  Truck,
  Package,
  Undo2,
  MapPin,
  MessagesSquare,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { workbenchAction } from "./actions";

export type WorkbenchOrder = {
  id: string;
  order_number: string | null;
  quantity: number;
  total_amount: number | null;
  unit_price: number | null;
  confirmation_status: string;
  delivery_status: string;
  confirmation_attempts: number;
  agent_comment: string | null;
  address: string | null;
  city: string | null;
  placed_at: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  assigned_confirmation_agent: string | null;
  assigned_delivery_agent: string | null;
};

const TERM_CONF = new Set(["confirmed", "cancelled"]);
const TERM_DELIV = new Set(["delivered", "returned", "cancelled"]);

const CONFIRM_ACTIONS = [
  { status: "confirmed", variant: "default" as const, icon: Check },
  { status: "not_answer", variant: "secondary" as const, icon: Phone },
  { status: "closed_phone", variant: "secondary" as const, icon: PhoneOff },
  { status: "cancelled", variant: "destructive" as const, icon: X },
];

const DELIVERY_ACTIONS = [
  { status: "bureau_deposited", variant: "secondary" as const, icon: Package },
  { status: "out_for_delivery", variant: "secondary" as const, icon: Truck },
  { status: "delivered", variant: "default" as const, icon: Check },
  { status: "returned", variant: "destructive" as const, icon: Undo2 },
];

export function Workbench({
  orders,
  role,
  agents,
}: {
  orders: WorkbenchOrder[];
  role: Role | null;
  agents: Record<string, string>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const canConfirm = role === "admin" || role === "confirmation_agent";
  const canDeliver = role === "admin" || role === "delivery_agent";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, o: WorkbenchOrder) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const comment = String(fd.get("comment") ?? "").trim();
    const cStatus = fd.get("confirmation_status");
    const dStatus = fd.get("delivery_status");
    let stage: "confirmation" | "delivery";
    let status: string;
    if (cStatus) {
      stage = "confirmation";
      status = String(cStatus);
    } else if (dStatus) {
      stage = "delivery";
      status = String(dStatus);
    } else {
      return;
    }
    setBusyId(o.id);
    const res = await workbenchAction({
      orderId: o.id,
      stage,
      status,
      comment,
      orderNumber: o.order_number,
    });
    setBusyId(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const showConfirm = canConfirm && !TERM_CONF.has(o.confirmation_status);
        const showDeliver = canDeliver && !TERM_DELIV.has(o.delivery_status);
        const confEmail = o.assigned_confirmation_agent ? agents[o.assigned_confirmation_agent] : null;
        const delivEmail = o.assigned_delivery_agent ? agents[o.assigned_delivery_agent] : null;

        return (
          <form key={o.id} onSubmit={(e) => onSubmit(e, o)} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{o.order_number ?? o.id.slice(0, 8)}</span>
                <Badge variant="secondary">
                  {t("workbench.attempts")}: {o.confirmation_attempts}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {confEmail ? (
                  <Badge variant="outline">
                    {t("role.confirmation_agent")}: {confEmail}
                  </Badge>
                ) : null}
                {delivEmail ? (
                  <Badge variant="outline">
                    {t("role.delivery_agent")}: {delivEmail}
                  </Badge>
                ) : null}
                <span>{formatDateTime(o.placed_at)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <div className="font-medium">{o.customer_name ?? "—"}</div>
                {o.customer_phone ? (
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {o.customer_phone}
                  </a>
                ) : null}
                {(o.city || o.address) && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{[o.city, o.address].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground sm:text-end">
                <div className="font-medium text-foreground">{o.product_name ?? "—"}</div>
                <div>
                  {o.quantity} × {formatCurrency(o.unit_price)} ={" "}
                  <span className="font-medium text-foreground">{formatCurrency(o.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MessagesSquare className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Textarea
                name="comment"
                placeholder={t("workbench.comment")}
                defaultValue={o.agent_comment ?? ""}
                rows={1}
                className="text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {showConfirm
                ? CONFIRM_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Button
                        key={`c_${a.status}`}
                        type="submit"
                        name="confirmation_status"
                        value={a.status}
                        variant={a.variant}
                        size="sm"
                        disabled={busyId === o.id}
                      >
                        <Icon className="h-4 w-4" />
                        {t(`status.confirmation_status.${a.status}`)}
                      </Button>
                    );
                  })
                : null}
              {showDeliver
                ? DELIVERY_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Button
                        key={`d_${a.status}`}
                        type="submit"
                        name="delivery_status"
                        value={a.status}
                        variant={a.variant}
                        size="sm"
                        disabled={busyId === o.id}
                      >
                        <Icon className="h-4 w-4" />
                        {t(`status.delivery_status.${a.status}`)}
                      </Button>
                    );
                  })
                : null}
            </div>
          </form>
        );
      })}
    </div>
  );
}
