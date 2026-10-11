"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, MoreHorizontal, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/status-pill";
import { PhoneLinks } from "@/components/phone-links";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toCSV, downloadCSV } from "@/lib/csv";
import type { StatusToken } from "@/lib/statuses";
import { CONFIRMATION_STATUSES } from "@/lib/enums";
import { bulkTransition, bulkAssignAgents } from "../actions";
import { OrderTimeline, type TimelineEvent } from "../order-timeline";
import { StatusCell } from "../status-cell";

export type AllRow = {
  id: string;
  order_number: string | null;
  placed_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_image: string | null;
  quantity: number;
  sale_price: number | null;
  delivery_fee: number | null;
  wilaya_name: string | null;
  source: string;
  confirmation_status: string;
  delivery_status: string;
  agent_name: string | null;
  is_duplicate_suspect: boolean;
  duplicate_of: string | null;
  commune: string | null;
  address: string | null;
  tags: { id: string; label: string; token: StatusToken }[];
  events: TimelineEvent[];
};

const SOURCE_TOKEN: Record<string, StatusToken> = {
  shopify: "info",
  lightfunnels: "violet",
  manual: "neutral",
};

export function OrdersAllTable({
  rows,
  total,
  pageSize,
  showMoney,
  agents,
  actorNames,
}: {
  rows: AllRow[];
  total: number;
  pageSize: number;
  showMoney: boolean;
  agents: { id: string; name: string; role: string }[];
  actorNames: Record<string, string>;
}) {
  const t = useTranslations();
  const router = useRouter();

  async function run(p: Promise<{ ok: true } | { ok: false; error: string }>, ok: string, clear: () => void) {
    const res = await p;
    if (res.ok) {
      toast.success(ok);
      clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function exportRows(list: AllRow[]) {
    const csv = toCSV(
      [
        { key: "order", label: "Order", value: (r: AllRow) => r.order_number ?? r.id.slice(0, 8) },
        { key: "placed", label: "Placed", value: (r: AllRow) => r.placed_at ?? "" },
        { key: "customer", label: "Customer", value: (r: AllRow) => r.customer_name ?? "" },
        { key: "phone", label: "Phone", value: (r: AllRow) => r.customer_phone ?? "" },
        { key: "product", label: "Product", value: (r: AllRow) => r.product_name ?? "" },
        { key: "qty", label: "Qty", value: (r: AllRow) => r.quantity },
        { key: "total", label: "Total (DZD)", value: (r: AllRow) => (r.sale_price ?? 0) * r.quantity },
        { key: "fee", label: "Delivery fee (DZD)", value: (r: AllRow) => r.delivery_fee ?? 0 },
        { key: "wilaya", label: "Wilaya", value: (r: AllRow) => r.wilaya_name ?? "" },
        { key: "source", label: "Source", value: (r: AllRow) => r.source },
        { key: "confirmation", label: "Confirmation", value: (r: AllRow) => r.confirmation_status },
        { key: "delivery", label: "Delivery", value: (r: AllRow) => r.delivery_status },
      ],
      list,
    );
    downloadCSV("orders.csv", csv);
  }

  const columns: Column<AllRow>[] = [
    {
      id: "order_number",
      header: t("orders.title"),
      sortable: true,
      sticky: true,
      width: "max-w-[9rem]",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/app/orders/${r.id}`}
            className="num truncate font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.order_number ?? r.id.slice(0, 8)}
          </Link>
          {r.is_duplicate_suspect ? (
            <Link
              href={r.duplicate_of ? `/app/orders/${r.duplicate_of}` : "#"}
              onClick={(e) => e.stopPropagation()}
              title={t("orders.duplicateWarning")}
              className="shrink-0"
            >
              <Chip token="danger" size="sm" icon={<Copy className="h-3 w-3" />}>
                {t("orders.duplicate")}
              </Chip>
            </Link>
          ) : null}
        </span>
      ),
    },
    {
      id: "placed_at",
      header: t("fields.placed_at"),
      sortable: true,
      width: "w-28",
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.placed_at)}</span>,
    },
    {
      id: "customer",
      header: t("fields.customer"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate">{r.customer_name ?? "—"}</div>
          {r.customer_phone ? <div className="num text-xs text-muted-foreground">{r.customer_phone}</div> : null}
        </div>
      ),
    },
    {
      id: "product",
      header: t("fields.product"),
      width: "max-w-[12rem]",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          {r.product_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.product_image} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded bg-surface-raised" />
          )}
          <span className="truncate">{r.product_name ?? "—"}</span>
        </div>
      ),
    },
    { id: "quantity", header: t("fields.quantity"), numeric: true, cell: (r) => <span className="num">{r.quantity}</span> },
    { id: "total", header: t("fields.total_amount"), numeric: true, cell: (r) => formatCurrency((r.sale_price ?? 0) * r.quantity) },
    { id: "delivery_fee", header: t("fields.delivery_fee"), numeric: true, defaultHidden: true, cell: (r) => formatCurrency(r.delivery_fee ?? 0) },
    { id: "wilaya", header: t("fields.wilaya"), cell: (r) => r.wilaya_name ?? "—" },
    {
      id: "source",
      header: t("fields.source"),
      align: "center",
      cell: (r) => (
        <Chip token={SOURCE_TOKEN[r.source] ?? "neutral"} size="sm">
          {t(`status.order_source.${r.source}`)}
        </Chip>
      ),
    },
    {
      id: "status",
      header: t("fields.status"),
      align: "center",
      cell: (r) => (
        <StatusCell
          orderId={r.id}
          order={{ confirmation_status: r.confirmation_status, delivery_status: r.delivery_status }}
          events={r.events}
          actorNames={actorNames}
        />
      ),
    },
    { id: "agent", header: t("fields.agent"), defaultHidden: true, cell: (r) => r.agent_name ?? "—" },
    {
      id: "tags",
      header: t("fields.tags"),
      defaultHidden: true,
      cell: (r) =>
        r.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {r.tags.map((tag) => (
              <Chip key={tag.id} token={tag.token} size="sm">{tag.label}</Chip>
            ))}
          </div>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <DataTable<AllRow>
      tableId="orders-all"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      total={total}
      pageSize={pageSize}
      selectable
      empty={{
        title: t("orders.none"),
        description: t("orders.emptyHint"),
        action: (
          <ButtonLink href="/app/orders/new" size="sm">
            {t("orders.new")}
          </ButtonLink>
        ),
      }}
      bulkActions={(keys, clear) => (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                {t("orders.setConfirmation")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {CONFIRMATION_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => run(bulkTransition(keys, "confirmation", s), t("common.updated"), clear)}
                >
                  <StatusPill kind="confirmation" status={s} size="sm" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <UserCog className="h-4 w-4" />
                {t("orders.assign")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>{t("workbench.assignConfirmation")}</DropdownMenuLabel>
              {agents.filter((a) => a.role === "confirmation_agent").map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => run(bulkAssignAgents(keys, a.id, null), t("common.updated"), clear)}>
                  {a.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("workbench.assignDelivery")}</DropdownMenuLabel>
              {agents.filter((a) => a.role === "delivery_agent").map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => run(bulkAssignAgents(keys, null, a.id), t("common.updated"), clear)}>
                  {a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => exportRows(rows.filter((r) => keys.includes(r.id)))}
          >
            <Download className="h-4 w-4" />
            {t("orders.export")} {keys.length}
          </Button>
        </>
      )}
      rowActions={(r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.view")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/app/orders/${r.id}`}>
                <ExternalLink className="h-4 w-4" /> {t("orders.openFull")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      renderSheet={(r) => ({
        title: (
          <span className="flex items-center gap-2">
            <span className="num">{r.order_number ?? r.id.slice(0, 8)}</span>
            <Link href={`/app/orders/${r.id}`} className="text-info hover:underline" aria-label={t("orders.openFull")}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </span>
        ),
        body: (
          <div className="space-y-5 text-sm">
            <StatusCell
              orderId={r.id}
              order={{ confirmation_status: r.confirmation_status, delivery_status: r.delivery_status }}
              events={r.events}
              actorNames={actorNames}
            />

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.customer")}</div>
              <div>{r.customer_name ?? "—"}</div>
              {r.customer_phone ? (
                <PhoneLinks phone={r.customer_phone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} />
              ) : null}
              <div className="text-muted-foreground">
                {[r.commune, r.wilaya_name].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.product")}</div>
              <div>
                {r.product_name ?? "—"} · {t("fields.quantity")} <span className="num">{r.quantity}</span>
              </div>
            </div>

            {showMoney ? (
              <div className="grid grid-cols-2 gap-3">
                <Money label={t("fields.total_amount")} value={(r.sale_price ?? 0) * r.quantity} />
                <Money label={t("fields.delivery_fee")} value={r.delivery_fee ?? 0} />
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("orders.history")}</div>
              <OrderTimeline events={r.events} actorNames={actorNames} />
            </div>

            <p className="text-xs text-muted-foreground">{formatDateTime(r.placed_at)}</p>
          </div>
        ),
      })}
    />
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="num font-semibold">{formatCurrency(value)}</div>
    </div>
  );
}
