"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { OrderNo } from "@/components/order-no";
import { RiskBadge } from "@/components/risk-badge";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatDate, formatInt, formatPercent } from "@/lib/format";
import { currentStatus } from "@/lib/statuses";
import { loadCustomerScore } from "./score-actions";
import type { CustomerScore, CustomerScoreResult, ScoreSummary } from "./_lib/customer-score";

export function CustomerRisk({ summary, scoped }: { summary: ScoreSummary | null; scoped: boolean }) {
  const t = useTranslations("customerScore");
  if (!summary) return <span className="text-xs text-muted-foreground">{t("unlinked")}</span>;

  const count = summary.reason === "returned" ? summary.returned
    : summary.reason === "cancelled" ? summary.cancelled : summary.noAnswer;
  return (
    <div className="space-y-1">
      {summary.score === null ? null : <RiskBadge score={summary.score} />}
      <p className="text-xs text-muted-foreground">
        {summary.state === "new" && scoped ? t("noVisibleOrders") : t(`state.${summary.state}`)}
        {" · "}{t(scoped ? "visibleCount" : "workspaceCount", { count: summary.total })}
      </p>
      {summary.score !== null ? (
        <p className="text-xs text-muted-foreground">{t(`reason.${summary.reason}`, { count })}</p>
      ) : null}
    </div>
  );
}

function ScoreDetails({ data }: { data: CustomerScore }) {
  const t = useTranslations("customerScore");
  const customer = data.customer;
  const scoped = data.scope === "visible";
  const lastStatus = customer?.confirmation && customer.delivery
    ? currentStatus({ confirmation_status: customer.confirmation, delivery_status: customer.delivery })
    : null;

  return (
    <div className="space-y-3">
      <CustomerRisk summary={customer} scoped={scoped} />
      {customer ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Fact label={t("total")} value={formatInt(customer.total)} />
          <Fact label={t("delivered")} value={formatInt(customer.delivered)} />
          <Fact label={t("returned")} value={formatInt(customer.returned)} />
          <Fact label={t("cancelled")} value={formatInt(customer.cancelled)} />
          <Fact label={t("noAnswer")} value={formatInt(customer.noAnswer)} />
          <Fact label={t(scoped ? "visibleDelivery" : "delivery")} value={customer.deliveryRate === null
            ? t("immature") : formatPercent(Math.round(customer.deliveryRate * 1000) / 10)} />
          {customer.lastAt ? <Fact label={t("lastOrder")} value={formatDate(customer.lastAt)} /> : null}
          {lastStatus ? <Fact label={t("lastStatus")} value={<StatusPill kind={lastStatus.kind} status={lastStatus.key} size="sm" />} /> : null}
          {customer.productOrders !== null ? <Fact label={t("thisProduct")} value={formatInt(customer.productOrders)} /> : null}
          {customer.lifetime != null ? <Fact label={t("lifetime")} value={formatCurrency(customer.lifetime)} /> : null}
        </dl>
      ) : null}
      <section className="space-y-1 border-t border-border pt-2">
        <h3 className="font-medium">{t("samePhone")}</h3>
        {data.related.length ? (
          <ul className="space-y-1">
            {data.related.map((order) => {
              const status = currentStatus({ confirmation_status: order.confirmation, delivery_status: order.delivery });
              return (
                <li key={order.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link className="num text-info underline" href={`/app/sell/orders/${order.id}`}><OrderNo seq={order.seq} /></Link>
                  <span className="num text-muted-foreground">{formatDate(order.at)}</span>
                  <StatusPill kind={status.kind} status={status.key} size="sm" />
                </li>
              );
            })}
          </ul>
        ) : <p className="text-muted-foreground">{t("noneOpen")}</p>}
        {data.hasMore ? <p className="text-muted-foreground">{t("moreOpen")}</p> : null}
      </section>
      {customer ? <Link className="inline-flex min-h-8 items-center text-info underline" href={`/app/sell/customers/${customer.id}`}>{t("viewAll")}</Link> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="num font-medium">{value}</dd></div>;
}

const CACHE_MS = 30_000;

export function CustomerScoreCard({ scope, orderId, name }: { scope: string; orderId: string; name: string | null }) {
  return <ScoreTrigger key={`${scope}:${orderId}`} scope={scope} orderId={orderId} name={name} />;
}

function ScoreTrigger({ scope, orderId, name }: { scope: string; orderId: string; name: string | null }) {
  const t = useTranslations("customerScore");
  const titleId = useId();
  const [mode, setMode] = useState<"hover" | "pinned" | null>(null);
  const [result, setResult] = useState<CustomerScoreResult | null>(null);
  const [pending, setPending] = useState(false);
  const timestamp = useRef(0);
  const loading = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  function cancelTimer() { clearTimeout(timer.current); }
  useEffect(() => () => clearTimeout(timer.current), []);

  async function load() {
    if (loading.current) return;
    loading.current = true;
    setPending(true);
    try {
      const next = await loadCustomerScore({ scope, orderId });
      timestamp.current = next.status === "ready" ? Date.now() : 0;
      setResult(next);
    } catch {
      timestamp.current = 0;
      setResult({ status: "error" });
    } finally {
      loading.current = false;
      setPending(false);
    }
  }

  function open(next: "hover" | "pinned") {
    restoreFocus.current = next === "pinned";
    setMode(next);
    if (Date.now() - timestamp.current > CACHE_MS) void load();
  }

  function leave() {
    cancelTimer();
    if (mode === "hover") timer.current = setTimeout(() => setMode(null), 180);
  }

  return (
    <Popover open={mode !== null} onOpenChange={(next) => { if (!next) { cancelTimer(); setMode(null); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("openFor", { name: name ?? t("unknown") })}
          className="block max-w-full truncate rounded-sm text-start font-medium underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            cancelTimer();
            if (!mode) timer.current = setTimeout(() => open("hover"), 240);
          }}
          onPointerLeave={leave}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelTimer();
            if (mode === "pinned") setMode(null);
            else {
              open("pinned");
              if (mode === "hover" && event.detail === 0) panel.current?.focus();
            }
          }}
        ><bdi>{name ?? t("unknown")}</bdi></button>
      </PopoverTrigger>
      <PopoverContent
        ref={panel}
        tabIndex={-1}
        aria-labelledby={titleId}
        className="max-h-[var(--radix-popover-content-available-height)] max-w-[min(calc(100vw-1rem),var(--radix-popover-content-available-width))] overflow-auto text-xs"
        collisionPadding={8}
        onOpenAutoFocus={(event) => { if (mode === "hover") event.preventDefault(); }}
        onCloseAutoFocus={(event) => { if (!restoreFocus.current) event.preventDefault(); }}
        onPointerEnter={cancelTimer}
        onPointerLeave={leave}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="mb-2 text-sm font-semibold">{t("title")}</h2>
        {pending || !result ? (
          <div role="status" aria-label={t("loading")} className="space-y-2">
            <div aria-hidden className="h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            <div aria-hidden className="h-12 w-full rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ) : result.status === "ready" ? <ScoreDetails data={result.data} /> : (
          <div className="space-y-2">
            <p role={result.status === "error" ? "alert" : "status"}>{t(result.status)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
