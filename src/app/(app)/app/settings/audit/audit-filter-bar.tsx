"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/fields/date-field";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/chip";
import { useTableLabel } from "./_lib/table-label";

const ALL = "__all";

export function AuditFilterBar({
  tables,
  actors,
}: {
  tables: readonly string[];
  actors: { user_id: string; display_name: string | null }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";
  const tableLabel = useTableLabel();
  const sortedTables = [...tables].sort((a, b) => tableLabel(a).localeCompare(tableLabel(b), locale));

  function setDates(from: string, to: string) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of [["from", from], ["to", to]] as const) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v || v === ALL) next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const chips: { key: string; label: string }[] = [];
  if (get("table")) chips.push({ key: "table", label: `${t("team.table")}: ${tableLabel(get("table"))}` });
  if (get("actor")) {
    const name = actors.find((a) => a.user_id === get("actor"))?.display_name ?? get("actor");
    chips.push({ key: "actor", label: `${t("fields.agent")}: ${name}` });
  }
  if (get("from")) chips.push({ key: "from", label: `${t("fields.from")}: ${formatDate(get("from"))}` });
  if (get("to")) chips.push({ key: "to", label: `${t("fields.to")}: ${formatDate(get("to"))}` });

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("team.table")}</span>
          <Select value={get("table") || ALL} onValueChange={(v) => setParam("table", v)}>
            <SelectTrigger>
              <SelectValue>{get("table") ? tableLabel(get("table")) : t("common.all")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("common.all")}</SelectItem>
              {sortedTables.map((n) => (
                <SelectItem key={n} value={n}>
                  {tableLabel(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.agent")}</span>
          <Select value={get("actor") || ALL} onValueChange={(v) => setParam("actor", v)}>
            <SelectTrigger>
              <SelectValue>
                {get("actor") ? (actors.find((a) => a.user_id === get("actor"))?.display_name ?? get("actor")) : t("common.all")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("common.all")}</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.display_name ?? a.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dates.period")}</span>
          <DateRangePicker from={get("from")} to={get("to")} onChange={setDates} />
        </label>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => setParam(c.key, null)} className="focus:outline-none">
              <Chip token="neutral" size="sm" className="gap-1 hover:bg-neutral-bg/70">
                {c.label}
                <X className="h-3 w-3" />
              </Chip>
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
            {t("orders.clearFilters")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
