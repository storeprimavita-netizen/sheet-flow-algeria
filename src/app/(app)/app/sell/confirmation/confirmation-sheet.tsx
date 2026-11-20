"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Phone, MessageCircle, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { AutoTextarea } from "@/components/fields/auto-textarea";
import { StatusPill } from "@/components/status-pill";
import { RiskBadge } from "@/components/risk-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { allStatuses, getStatus } from "@/lib/statuses";
import { whatsappHref } from "@/lib/customers";
import { updateOrderStatus, logConfirmationAttempt } from "../orders/actions";
import type { ConfRow } from "./confirmation-table";
import { OrderNo } from "@/components/order-no";

/**
 * Confirmation call sheet. Sheet order (per section-checklists): name → big
 * `tel:` link → risk badge → previous orders → product/qty/price → large status
 * buttons → comment → Save / Save & open next. ↑/↓ moves between queue rows.
 * Rendered with `key={order.id}` so uncontrolled fields reset per order.
 */
export function ConfirmationSheet({ order, orderedKeys }: { order: ConfRow; orderedKeys: string[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [selected, setSelected] = React.useState(order.confirmation_status);
  const [busy, setBusy] = React.useState(false);

  const idx = orderedKeys.indexOf(order.id);
  const nextKey = idx >= 0 && idx < orderedKeys.length - 1 ? orderedKeys[idx + 1] : null;
  const prevKey = idx > 0 ? orderedKeys[idx - 1] : null;
  const options = allStatuses("confirmation");
  const commentId = `conf-comment-${order.id}`;

  function openRow(key: string | null) {
    if (!key) return;
    const next = new URLSearchParams(sp.toString());
    next.set("row", key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function save(openNext: boolean) {
    const def = getStatus("confirmation", selected);
    if (def?.requiresConfirm && !window.confirm(t("orders.confirmStatus", { status: t(def.label) }))) return;
    const comment = (document.getElementById(commentId) as HTMLTextAreaElement | null)?.value ?? "";
    setBusy(true);
    const res = await updateOrderStatus({ orderId: order.id, stage: "confirmation", status: selected, comment });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.warning) toast.warning(res.warning);
    else toast.success(t("common.updated"));
    if (openNext && nextKey) openRow(nextKey);
    router.refresh();
  }

  async function dial() {
    await logConfirmationAttempt(order.id);
    toast.success(t("orders.logAttempt"));
    router.refresh();
  }

  // ↑/↓ move between queue rows while the sheet is open
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openRow(nextKey);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        openRow(prevKey);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, prevKey]);

  return (
    <div className="space-y-5 text-sm">
      {/* name */}
      <div>
        <div className="text-lg font-semibold">{order.customer_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {[order.commune].filter(Boolean).join(" · ")} · {formatDate(order.placed_at)}
        </div>
      </div>

      {/* big tel: link */}
      {order.customer_phone ? (
        <div className="flex gap-2">
          <a
            href={`tel:${order.customer_phone}`}
            onClick={order.locked ? undefined : dial}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-success-bg py-3 text-base font-semibold text-success transition-colors hover:brightness-105"
          >
            <PhoneCall className="h-5 w-5" />
            <span className="num">{order.customer_phone}</span>
          </a>
          <a
            href={whatsappHref(order.customer_phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("orders.whatsapp")}
            title={t("orders.whatsapp")}
            className="flex items-center justify-center rounded-lg border border-border px-4 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        </div>
      ) : null}

      {/* risk + dial count */}
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge score={order.risk_score} reason={order.risk_reason} size="md" />
        <Chip token="neutral" size="sm">
          {t("fields.deliveryRate")}: <span className="num">{order.delivery_rate}</span>
        </Chip>
        <Chip token="neutral" size="sm" icon={<Phone className="h-3 w-3" />}>
          {t("orders.logAttempt")}: <span className="num">{order.confirmation_attempts}</span>
        </Chip>
        {order.is_duplicate_suspect && order.duplicate_of ? (
          <Link href={`/app/sell/orders/${order.duplicate_of}`}>
            <Chip token="danger" size="sm">
              {t("orders.duplicate")}
            </Chip>
          </Link>
        ) : null}
      </div>

      {/* previous orders */}
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("orders.previousOrders")} ({order.recent.length})
        </div>
        {order.recent.length === 0 ? (
          <p className="text-muted-foreground">{t("orders.noPrevious")}</p>
        ) : (
          <ul className="space-y-1">
            {order.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/sell/orders/${p.id}`} className="num text-info hover:underline">
                  <OrderNo seq={p.order_seq} />
                </Link>
                <div className="flex items-center gap-1.5">
                  <StatusPill kind="delivery" status={p.delivery_status} size="sm" showIcon={false} />
                  <span className="text-xs text-muted-foreground">{formatDate(p.placed_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* product / qty / price */}
      <div className="rounded-lg border border-border p-3">
        <div className="font-medium">{order.product_name ?? "—"}</div>
        <div className="text-muted-foreground">
          {t("fields.quantity")} <span className="num">{order.quantity}</span> ·{" "}
          <span className="num">{formatCurrency((order.sale_price ?? 0) * order.quantity)}</span>
        </div>
      </div>

      {/* large status buttons */}
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.confirmation_status")}</div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSelected(o.key)}
              className={
                "flex items-center justify-center rounded-lg border py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (selected === o.key ? "border-primary bg-primary/10" : "border-border hover:bg-surface-raised")
              }
            >
              <StatusPill kind="confirmation" status={o.key} />
            </button>
          ))}
        </div>
      </div>

      {/* comment */}
      <div className="space-y-1.5">
        <label htmlFor={commentId} className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("fields.agent_comment")}
        </label>
        <AutoTextarea id={commentId} defaultValue={order.confirmation_comment ?? ""} />
      </div>

      {/* save actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(false)} disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
        <Button variant="outline" onClick={() => save(true)} disabled={busy || !nextKey}>
          {t("orders.saveNext")}
        </Button>
      </div>
    </div>
  );
}
