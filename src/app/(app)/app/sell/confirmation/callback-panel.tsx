"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { DateField, TimeField } from "@/components/fields/date-field";
import { Field } from "@/components/field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { loadAttempts, saveCallback, type AttemptsResult, type CallbackResult } from "./actions";
import { formatAlgiersDateTime, isoToAlgiers } from "./_lib/callback";
import type { ConfRow } from "./confirmation-table";

/** Schedule / reschedule / clear the callback. Saves only the callback, never the status or note. */
export function CallbackForm({ order }: { order: ConfRow }) {
  const t = useTranslations("callbacks");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Extract<CallbackResult, { ok: false }>["error"] | null>(null);
  const saveRef = React.useRef<HTMLButtonElement>(null);
  const initial = isoToAlgiers(order.callback_at);
  const dateId = `callback-date-${order.id}`;
  const timeId = `callback-time-${order.id}`;
  const errorId = `callback-error-${order.id}`;

  async function submit(op: "schedule" | "clear", form: HTMLFormElement) {
    if (busy) return;
    const values = new FormData(form);
    setBusy(true);
    setError(null);
    let result: CallbackResult;
    try {
      result = await saveCallback(op === "clear"
        ? { op, orderId: order.id }
        : { op, orderId: order.id, date: values.get("date"), time: values.get("time") });
    } catch {
      result = { ok: false, error: "failed" };
    }
    setBusy(false);
    // the button that was used may be disabled now: keep focus inside the sheet
    saveRef.current?.focus();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(t(op === "clear" ? "cleared" : "saved"));
    router.refresh();
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
      {order.callback_at ? (
        <p className={order.callback_due ? "text-warning" : "text-muted-foreground"}>
          {t(order.callback_due ? "overdue" : "scheduled")}: <span className="num">{formatAlgiersDateTime(order.callback_at)}</span>
        </p>
      ) : <p className="text-muted-foreground">{t("none")}</p>}
      {order.can_callback ? (
        <form
          // remount the fields (not the focused button's form position) when the saved value changes
          key={order.callback_at ?? "none"}
          noValidate
          aria-describedby={error ? errorId : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            void submit("schedule", event.currentTarget);
          }}
          className="space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("date")} htmlFor={dateId}>
              <DateField id={dateId} name="date" defaultValue={initial.date} />
            </Field>
            <Field label={t("time")} htmlFor={timeId}>
              <TimeField id={timeId} name="time" defaultValue={initial.time} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("timezone")}</p>
          {error ? <p id={errorId} role="alert" className="text-danger">{t(`error.${error}`)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button ref={saveRef} type="submit" size="sm" aria-disabled={busy}>
              {busy ? t("saving") : t("save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!order.callback_at}
              aria-disabled={busy}
              onClick={(event) => void submit("clear", event.currentTarget.form!)}
            >
              {t("clear")}
            </Button>
          </div>
        </form>
      ) : <p className="text-xs text-muted-foreground">{t("unavailable")}</p>}
    </section>
  );
}

/** Recorded call outcomes of the open order only; loaded when the sheet opens. */
export function AttemptTimeline({ orderId, status }: { orderId: string; status: string }) {
  const t = useTranslations("callbacks");
  const [result, setResult] = React.useState<AttemptsResult | null>(null);
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    loadAttempts(orderId)
      .catch((): AttemptsResult => ({ ok: false }))
      .then((next) => { if (live) setResult(next); });
    return () => { live = false; };
    // a status change is a new entry
  }, [orderId, status, retry]);

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t("outcomes")}</h3>
      {!result ? (
        <div role="status" className="space-y-1">
          <span className="sr-only">{t("loading")}</span>
          <div className="h-5 animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
        </div>
      ) : !result.ok ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-danger">{t("loadError")}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); setRetry((n) => n + 1); }}>
            {t("retry")}
          </Button>
        </div>
      ) : !result.attempts.length ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {result.more ? (
            <p className="text-xs text-muted-foreground">
              {t("latestOnly", { count: result.attempts.length })}{" "}
              <Link href={`/app/sell/orders/${orderId}`} className="text-info hover:underline">{t("fullHistory")}</Link>
            </p>
          ) : null}
          <ol className="space-y-2">
            {result.attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 border-s-2 border-border ps-3">
                <StatusPill kind="confirmation" status={attempt.outcome} size="sm" />
                <span className="text-xs text-muted-foreground">
                  <bdi>{attempt.actor.kind === "user" ? attempt.actor.name : t(`actor.${attempt.actor.kind}`)}</bdi>
                  {" · "}
                  <time dateTime={attempt.at} className="num">{formatAlgiersDateTime(attempt.at)}</time>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
