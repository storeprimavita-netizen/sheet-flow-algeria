"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* Values are always ISO `YYYY-MM-DD` (URL params, form posts, DB); display is
 * dd/mm/yyyy via formatDate(). The calendar is a small hand-rolled month grid
 * — no date-picker dependency. Week starts Saturday (Algeria). */

const iso = (d: Date) => d.toLocaleDateString("en-CA");
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEK_START = 6; // Saturday

const triggerCls =
  "num flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-start text-sm shadow-sm transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function Calendar({
  from,
  to,
  onPick,
}: {
  from: string;
  to: string;
  onPick: (iso: string) => void;
}) {
  const t = useTranslations("dates");
  const locale = useLocale();
  const [month, setMonth] = React.useState(() => {
    const d = from ? parse(from) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const lead = (month.getDay() - WEEK_START + 7) % 7;
  const first = addDays(month, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const today = iso(new Date());
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(-1)} aria-label={t("prevMonth")}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="text-sm font-medium capitalize">{title}</div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(1)} aria-label={t("nextMonth")}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-faint">
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="py-1">{weekday.format(d)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const v = iso(d);
          const edge = v === from || v === to;
          const inRange = from && to && v > from && v < to;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              aria-pressed={edge}
              className={cn(
                "num h-8 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                d.getMonth() !== month.getMonth() && "text-faint",
                inRange && "rounded-none bg-primary/10",
                edge ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-surface-raised",
                v === today && !edge && "ring-1 ring-inset ring-border-strong",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Single date: popover calendar, dd/mm/yyyy display, ISO value. Posts `name`
 * through a hidden input so it drops into server-action forms unchanged. */
export function DateField({
  name,
  defaultValue,
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const t = useTranslations("dates");
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const current = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <PopoverTrigger asChild>
        <button id={id} type="button" disabled={disabled} className={cn(triggerCls, className)}>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !current && "text-faint")}>{current ? formatDate(current) : t("pick")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          from={current}
          to={current}
          onPick={(v) => {
            set(v);
            setOpen(false);
          }}
        />
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { set(iso(new Date())); setOpen(false); }}>
            {t("today")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { set(""); setOpen(false); }}>
            {t("clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Native time input (`HH:MM`), styled to tokens. */
export function TimeField({
  name,
  defaultValue,
  disabled,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="time"
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      className={cn(triggerCls, "[color-scheme:inherit]", className)}
    />
  );
}

type PresetKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";

function presetRange(key: PresetKey): [string, string] {
  const now = new Date();
  switch (key) {
    case "today": return [iso(now), iso(now)];
    case "yesterday": return [iso(addDays(now, -1)), iso(addDays(now, -1))];
    case "last7": return [iso(addDays(now, -6)), iso(now)];
    case "last30": return [iso(addDays(now, -29)), iso(now)];
    case "thisMonth": return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
    case "lastMonth":
      return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))];
  }
}
const PRESETS: PresetKey[] = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"];

/** Range picker for filter bars: one trigger ("01/10/2026 – 11/10/2026" or
 * "All time"), popover with presets + a click-start/click-end calendar. */
export function DateRangePicker({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const t = useTranslations("dates");
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<[string, string]>([from, to]);
  React.useEffect(() => setDraft([from, to]), [from, to, open]);

  const apply = (f: string, tt: string) => {
    onChange(f, tt);
    setOpen(false);
  };
  const label = from || to ? `${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}` : t("allTime");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerCls, className)}>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto gap-3">
        <div className="flex flex-col gap-0.5 border-e border-border pe-3">
          {PRESETS.map((p) => (
            <Button key={p} type="button" variant="ghost" size="sm" className="justify-start" onClick={() => apply(...presetRange(p))}>
              {t(p)}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="mt-auto justify-start text-muted-foreground" onClick={() => apply("", "")}>
            <X className="h-3.5 w-3.5" />
            {t("allTime")}
          </Button>
        </div>
        <Calendar
          from={draft[0]}
          to={draft[1]}
          onPick={(v) => {
            const [f, tt] = draft;
            // First click (or a click after a complete range) starts a new range.
            if (!f || tt) return setDraft([v, ""]);
            apply(v < f ? v : f, v < f ? f : v);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Form version of the range picker. Posts `${name}From` / `${name}To`. */
export function DateRangeField({
  name = "date",
  defaultFrom = "",
  defaultTo = "",
}: {
  name?: string;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [range, setRange] = React.useState<[string, string]>([defaultFrom, defaultTo]);
  return (
    <>
      <input type="hidden" name={`${name}From`} value={range[0]} />
      <input type="hidden" name={`${name}To`} value={range[1]} />
      <DateRangePicker from={range[0]} to={range[1]} onChange={(f, tt) => setRange([f, tt])} />
    </>
  );
}
