"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/fields/date-field";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";
import { STATS_PERSIST_KEYS, pickParams } from "@/lib/query-string";
import { cn } from "@/lib/utils";

export type StatsOpt = { value: string; label: string };
export type StatsSeasonOpt = { id: string; label: string; years: number[] };

const ALL = "__all"; // Radix Select / Combobox sentinel for the "All" row
const STORAGE_KEY = "mnw:statsFilters"; // NOT the dashboard's key
const SECONDARY = ["f_category", "f_wilaya", "f_source", "f_agent", "f_delivery"] as const;

/**
 * Statistics filter bar: every filter lives in the URL (`parseStatsFilters` reads it
 * server-side). Picking a season clears the explicit dates; explicit dates in the URL still win
 * (the server reports `overridden`). The last-used filters are remembered per browser
 * (allow-listed keys, never the open drill `wilaya`).
 */
export function StatsFilterBar({
  products, categories, wilayas, sources, agents, deliveryTypes, seasons, overridden, notes,
}: {
  products: StatsOpt[];
  categories: StatsOpt[];
  wilayas: StatsOpt[];
  sources: StatsOpt[];
  agents: StatsOpt[];
  deliveryTypes: StatsOpt[];
  seasons: StatsSeasonOpt[];
  /** explicit dates sit next to a season: the dates win */
  overridden: boolean;
  /** translated notes for dropped values (unknown season / year) */
  notes: string[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const restored = React.useRef(false);
  const get = (k: string) => sp.get(k) ?? "";

  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (sp.toString()) return; // an explicit URL wins over the remembered one
    const saved = pickParams(localStorage.getItem(STORAGE_KEY) ?? "", STATS_PERSIST_KEYS);
    if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: URLSearchParams) {
    const remembered = pickParams(next.toString(), STATS_PERSIST_KEYS);
    if (remembered) localStorage.setItem(STORAGE_KEY, remembered);
    else localStorage.removeItem(STORAGE_KEY);
    router.push(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }
  function change(edit: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString());
    edit(next);
    go(next);
  }
  const setParam = (k: string, v: string | null) =>
    change((p) => (!v || v === ALL ? p.delete(k) : p.set(k, v)));
  const setDates = (from: string, to: string) =>
    change((p) => {
      for (const [k, v] of [["from", from], ["to", to]] as const) (v ? p.set(k, v) : p.delete(k));
    });
  const setSeason = (id: string) =>
    change((p) => {
      p.delete("year");
      p.delete("from");
      p.delete("to"); // picking a season replaces the dates
      if (id && id !== ALL) p.set("season", id);
      else p.delete("season");
    });

  const season = seasons.find((s) => s.id === get("season"));
  const year = get("year");
  const yearOpts = season?.years ?? [];

  const effectiveYear = year && yearOpts.includes(Number(year)) ? year : yearOpts[0] ? String(yearOpts[0]) : "";
  const chips: { key: string; label: string; remove: (p: URLSearchParams) => void }[] = [];
  const one = (key: string, label: string, opts: StatsOpt[], param = key) => {
    const o = opts.find((x) => x.value === get(param));
    if (get(param) && o) chips.push({ key, label: `${label}: ${o.label}`, remove: (p) => p.delete(param) });
  };
  if (get("from") || get("to"))
    chips.push({
      key: "period",
      label: `${t("dates.period")}: ${get("from") ? formatDate(get("from")) : "…"} – ${get("to") ? formatDate(get("to")) : "…"}`,
      remove: (p) => { p.delete("from"); p.delete("to"); },
    });
  if (season)
    chips.push({
      key: "season",
      label: `${t("statistics.filters.season")}: ${season.label}${effectiveYear ? ` ${effectiveYear}` : ""}${overridden ? ` (${t("statistics.filters.overridden")})` : ""}`,
      remove: (p) => { p.delete("season"); p.delete("year"); },
    });
  one("product", t("fields.product"), products);
  one("f_category", t("fields.category"), categories);
  one("f_wilaya", t("fields.wilaya"), wilayas);
  one("f_source", t("fields.source"), sources);
  one("f_agent", t("fields.agent"), agents);
  one("f_delivery", t("statistics.filters.deliveryType"), deliveryTypes);

  const secondaryActive = SECONDARY.filter((k) => get(k)).length;
  const [more, setMore] = React.useState(secondaryActive > 0);

  const allOpt = { value: ALL, label: t("common.all") };
  const field = (label: string, node: React.ReactNode, cls?: string) => (
    <div className={cn("space-y-1", cls)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {node}
    </div>
  );
  const select = (param: string, label: string, opts: StatsOpt[], extra?: { disabled?: boolean; hint?: string }) =>
    field(
      label,
      <>
        <Select value={get(param) || ALL} onValueChange={(v) => setParam(param, v)} disabled={extra?.disabled}>
          <SelectTrigger aria-label={label}>
            {/* explicit label: Radix leaves SelectValue blank until hydration */}
            <SelectValue>{opts.find((o) => o.value === get(param))?.label ?? t("common.all")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("common.all")}</SelectItem>
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {extra?.disabled && extra.hint ? <p className="text-xs text-muted-foreground">{extra.hint}</p> : null}
      </>,
    );
  const combo = (param: string, label: string, opts: StatsOpt[]) =>
    field(
      label,
      <Combobox
        ariaLabel={label}
        options={[allOpt, ...opts]}
        value={get(param) || ALL}
        onChange={(v) => setParam(param, v)}
        placeholder={t("common.all")}
        searchPlaceholder={t("common.searchPlaceholder")}
        emptyText={t("common.noMatches")}
      />,
    );

  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]";

  return (
    <div className="card-surface z-10 w-full space-y-3 rounded-xl p-3 backdrop-blur sm:sticky sm:top-0">
      <div className={grid}>
        {field(
          t("dates.period"),
          <DateRangePicker from={get("from")} to={get("to")} onChange={setDates} />,
          "col-span-2 sm:col-span-1",
        )}
        {select("season", t("statistics.filters.season"), seasons.map((s) => ({ value: s.id, label: s.label })))}
        {field(
          t("statistics.filters.year"),
          <>
            <Select
              value={year && yearOpts.includes(Number(year)) ? year : ALL}
              onValueChange={(v) => setParam("year", v)}
              disabled={!season}
            >
              <SelectTrigger aria-label={t("statistics.filters.year")}>
                <SelectValue>{year && yearOpts.includes(Number(year)) ? year : t("statistics.filters.latestYear")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("statistics.filters.latestYear")}</SelectItem>
                {yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {!season ? <p className="text-xs text-muted-foreground">{t("statistics.filters.yearNeedsSeason")}</p> : null}
          </>,
        )}
        {combo("product", t("fields.product"), products)}
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-expanded={more}
          aria-controls="stats-more-filters"
          onClick={() => setMore((v) => !v)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} />
          {t("statistics.filters.more", { n: secondaryActive })}
        </Button>
      </div>
      <div id="stats-more-filters" hidden={!more} className={cn(grid, !more && "hidden")}>
        {select("f_category", t("fields.category"), categories, { disabled: categories.length === 0, hint: t("statistics.filters.noCategories") })}
        {combo("f_wilaya", t("fields.wilaya"), wilayas)}
        {select("f_source", t("fields.source"), sources)}
        {combo("f_agent", t("fields.agent"), agents)}
        {select("f_delivery", t("statistics.filters.deliveryType"), deliveryTypes)}
      </div>

      {overridden || notes.length > 0 ? (
        <div role="status" className="space-y-1 text-xs text-muted-foreground">
          {overridden ? <p>{t("statistics.filters.overriddenNote")}</p> : null}
          {notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={t("statistics.filters.remove", { name: c.label })}
              onClick={() => change(c.remove)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Chip token="neutral" size="sm" className="gap-1 hover:bg-neutral-bg/70">
                <bdi>{c.label}</bdi>
                <X className="h-3 w-3" aria-hidden />
              </Chip>
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              router.push(pathname, { scroll: false });
            }}
          >
            {t("statistics.clearFilters")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
