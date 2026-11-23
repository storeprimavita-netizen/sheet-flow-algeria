"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { GripVertical, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { OrderNo } from "@/components/order-no";
import { Empty } from "@/components/empty";
import { PhoneLinks } from "@/components/phone-links";
import { CustomerRisk, CustomerScoreCard } from "../confirmation/customer-score-card";
import { RiskBadge } from "@/components/risk-badge";
import { StatusPill } from "@/components/status-pill";
import { useStatusLabel } from "@/components/status-labels-provider";
import { SwapBadge } from "@/components/swap-badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { formatCurrency, formatInt, formatOrderNo } from "@/lib/format";
import type { KanbanField, ViewPresentation, ViewScope } from "@/lib/order-views";
import { getStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { moveOrderOnBoard, type BoardMoveResult } from "./actions";
import { canDropOnColumn, groupKanbanRows, kanbanStage, kanbanTargets, moveKanbanRow, type KanbanRow } from "./_lib/kanban";

type Move = { orderId: string; status: string };
type Failure = { move: Move; error: Extract<BoardMoveResult, { ok: false }>["error"] };

export function OrderBoardLoadError() {
  const t = useTranslations("orders");
  const router = useRouter();
  return (
    <Empty>
      <p role="alert">{t("loadError")}</p>
      <Button className="mt-3" type="button" variant="outline" onClick={() => router.refresh()}>{t("retry")}</Button>
    </Empty>
  );
}

function cardValue(row: KanbanRow, field: KanbanField): ReactNode {
  switch (field) {
    case "product": return row.productName;
    case "wilaya": return row.wilayaName;
    case "total": return row.total === undefined ? null : formatCurrency(row.total);
    case "attempts": return row.attempts === undefined ? null : formatInt(row.attempts);
    case "age": return row.age;
    case "score": return row.score ? <RiskBadge score={row.score.value} reason={row.score.reason} /> : null;
  }
}

export function OrderKanban({
  scope, rows, presentation, isAdmin, empty, customerScoreScope,
}: {
  scope: ViewScope;
  customerScoreScope?: string | null;
  rows: KanbanRow[];
  presentation: ViewPresentation;
  isAdmin: boolean;
  empty: ReactNode;
}) {
  const t = useTranslations();
  const statusLabel = useStatusLabel();
  const router = useRouter();
  const stage = kanbanStage(scope);
  const { groupBy, cardFields } = presentation;
  const [optimistic, applyMove] = useOptimistic(rows, moveKanbanRow);
  const [transitioning, startTransition] = useTransition();
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [failures, setFailures] = useState<Record<string, Failure>>({});
  const [confirmation, setConfirmation] = useState<Move | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const moving = useRef(new Set<string>());
  const focusAfterMove = useRef<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const links = useRef(new Map<string, HTMLAnchorElement>());

  const restoreFocus = (id: string) => {
    const target = controls.current.get(id) ?? links.current.get(id) ?? board.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  useEffect(() => {
    if (transitioning || !focusAfterMove.current) return;
    restoreFocus(focusAfterMove.current);
    focusAfterMove.current = null;
  }, [transitioning, optimistic]);

  function submit(move: Move) {
    if (moving.current.has(move.orderId)) return;
    moving.current.add(move.orderId);
    setBusy(new Set(moving.current));
    setFailures((previous) => {
      const next = { ...previous };
      delete next[move.orderId];
      return next;
    });
    focusAfterMove.current = move.orderId;
    startTransition(async () => {
      applyMove(move);
      let result: BoardMoveResult;
      try {
        result = await moveOrderOnBoard({ ...move, stage });
      } catch {
        result = { ok: false, error: "failed" };
      } finally {
        moving.current.delete(move.orderId);
        setBusy(new Set(moving.current));
      }
      if (!result.ok) {
        const failed = result;
        setFailures((previous) => ({ ...previous, [move.orderId]: { move, error: failed.error } }));
        return;
      }
      if (result.warning) toast.warning(t("orderViews.board.carrierWarning"));
      else toast.success(t("common.updated"));
      router.refresh();
    });
  }

  function requestMove(row: KanbanRow, status: string) {
    const choice = kanbanTargets(scope, isAdmin, row).find((target) => target.key === status);
    if (!choice || moving.current.has(row.id)) return;
    const move = { orderId: row.id, status };
    if (choice.requiresConfirm) setConfirmation(move);
    else submit(move);
  }

  const dragged = optimistic.find((row) => row.id === dragId);
  const confirming = confirmation ? optimistic.find((row) => row.id === confirmation.orderId) : undefined;
  const confirmStatus = confirmation ? getStatus(stage, confirmation.status) : undefined;

  return (
    <>
      <div ref={board} role="region" aria-label={t("orderViews.board.label")} tabIndex={0}
        className="w-full min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {optimistic.length ? (
          <div className="flex max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-3">
            {groupKanbanRows(optimistic, groupBy, stage).map((column) => {
              const accepts = !!dragged && canDropOnColumn(scope, isAdmin, groupBy, dragged, column.key);
              return (
                <section key={column.key}
                  onDragOver={accepts ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } : undefined}
                  onDrop={accepts ? (event) => {
                    event.preventDefault();
                    requestMove(dragged, column.key);
                    setDragId(null);
                  } : undefined}
                  className={cn("w-64 shrink-0 rounded-xl border border-border bg-surface p-2", accepts && "border-primary")}>
                  <h2 className="mb-2 flex items-center justify-between gap-2 px-1 text-sm font-medium">
                    {groupBy === "status" ? <StatusPill kind={stage} status={column.key} size="sm" /> :
                      <bdi className="min-w-0 truncate" title={column.label ?? undefined}>
                        {column.label ?? t("orderViews.board.missingGroup")}
                      </bdi>}
                    <span className="num shrink-0 text-xs text-muted-foreground">{formatInt(column.rows.length)}</span>
                  </h2>
                  {!column.rows.length ? (
                    <p className="px-1 py-5 text-center text-xs text-muted-foreground">{t("orders.kanbanEmpty")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {column.rows.map((row) => {
                        const targets = kanbanTargets(scope, isAdmin, row);
                        const loading = busy.has(row.id);
                        const failure = failures[row.id];
                        return (
                          <li key={row.id} aria-busy={loading} className="card-surface min-w-0 space-y-2 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <Link href={`/app/sell/orders/${row.id}`} ref={(node) => {
                                if (node) links.current.set(row.id, node);
                                else links.current.delete(row.id);
                              }} className="num rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <OrderNo seq={row.orderSeq} />
                              </Link>
                              {row.duplicate ? <Chip token="danger" size="sm">{t("orders.duplicate")}</Chip> : null}
                              {targets.length && groupBy === "status" && !loading ? (
                                <span aria-hidden draggable onDragStart={(event) => {
                                  event.dataTransfer.setData("text/plain", formatOrderNo(row.orderSeq));
                                  event.dataTransfer.effectAllowed = "move";
                                  setDragId(row.id);
                                }} onDragEnd={() => setDragId(null)}
                                  className="ms-auto cursor-grab select-none rounded-sm p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing">
                                  <GripVertical className="size-4" />
                                </span>
                              ) : null}
                              {loading ? <LoaderCircle aria-label={t("orderViews.board.moving")} className="ms-auto size-4 animate-spin motion-reduce:animate-none" /> : null}
                            </div>
                            {scope === "confirmation" && customerScoreScope ? (
                              <CustomerScoreCard scope={customerScoreScope} orderId={row.id} name={row.customerName} />
                            ) : <bdi className="block truncate" title={row.customerName ?? undefined}>{row.customerName ?? "—"}</bdi>}
                            {row.customerPhone ? <PhoneLinks phone={row.customerPhone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} /> : null}
                            {row.swappedTo ? <SwapBadge to={row.swappedTo} /> : null}
                            {cardFields.length ? (
                              <dl className="space-y-1 text-xs">
                                {cardFields.map((field) => (
                                  <div key={field} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                                    <dt className="text-muted-foreground">{
                                      field === "total" && scope === "shipping" ? t("orders.toCollect") :
                                        field === "score" && !isAdmin ? t("orderViews.board.visibleScore") : t(`orderViews.card.${field}`)
                                    }</dt>
                                    <dd className="min-w-0 break-words text-end [font-variant-numeric:tabular-nums]">{field === "score" && scope === "confirmation" && row.customerRisk !== undefined
                                      ? <CustomerRisk summary={row.customerRisk} scoped={!isAdmin} />
                                      : cardValue(row, field) ?? "—"}</dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                            {row.deliveryStatus ? <StatusPill kind="delivery" status={row.deliveryStatus} size="sm" /> : null}
                            {targets.length ? (
                              <Select value={row.status} disabled={loading} onValueChange={(status) => requestMove(row, status)}>
                                <SelectTrigger ref={(node) => {
                                  if (node) controls.current.set(row.id, node);
                                  else controls.current.delete(row.id);
                                }} aria-label={t("orderViews.board.moveOrder", { order: formatOrderNo(row.orderSeq) })}
                                  className="w-full min-h-11 justify-between md:min-h-9">
                                  <StatusPill kind={stage} status={row.status} size="sm" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={row.status} disabled><StatusPill kind={stage} status={row.status} size="sm" /></SelectItem>
                                  {targets.map((item) => (
                                    <SelectItem key={item.key} value={item.key}><StatusPill kind={stage} status={item.key} size="sm" /></SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : <StatusPill kind={stage} status={row.status} size="sm" />}
                            {failure ? (
                              <div className="space-y-1">
                                <p role="alert" className="text-xs text-danger">{t(`orderViews.board.error.${failure.error}`)}</p>
                                <Button type="button" size="sm" variant="outline" disabled={loading}
                                  onClick={() => requestMove(row, failure.move.status)}>{t("orderViews.retry")}</Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : empty}
      </div>
      {confirmation && confirming && confirmStatus ? (
        <Dialog open onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
          <DialogContent onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!moving.current.has(confirming.id)) restoreFocus(confirming.id);
          }}>
            <DialogHeader>
              <DialogTitle>{t("orderViews.board.moveOrder", { order: formatOrderNo(confirming.orderSeq) })}</DialogTitle>
              <DialogDescription>{t("orders.confirmStatus", { status: statusLabel(stage, confirmStatus.key, t(confirmStatus.label)) })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmation(null)}>{t("orderViews.cancel")}</Button>
              <Button type="button" variant="destructive" onClick={() => {
                submit(confirmation);
                setConfirmation(null);
              }}>{t("orderViews.board.confirmMove")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
