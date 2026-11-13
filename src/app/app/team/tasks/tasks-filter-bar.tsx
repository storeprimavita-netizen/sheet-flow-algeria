"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlarmClockCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { TASK_PRIORITIES } from "@/lib/enums";
import { TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { SelectOptionRow } from "@/components/fields/select-option-row";

const ALL_OWNERS = "__all";

/**
 * Owner/priority/product filters + an "overdue only" toggle. "My tasks" is
 * the default: when `owner` isn't in the URL at all, the page filters to the
 * current user server-side (see tasks/page.tsx) — only an explicit choice
 * (a teammate or "All") shows up here as a removable chip.
 */
export function TasksFilterBar({
  owners,
  products,
  currentUserId,
}: {
  owners: { user_id: string; display_name: string | null }[];
  products: { id: string; name: string }[];
  currentUserId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const get = (k: string) => sp.get(k) ?? "";
  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!v) next.delete(k);
    else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const ownerValue = get("owner") || currentUserId;
  const overdueOn = get("due") === "overdue";

  const chips: { key: string; label: string }[] = [];
  if (get("owner") && get("owner") !== currentUserId) {
    const label =
      get("owner") === ALL_OWNERS
        ? t("common.all")
        : (owners.find((o) => o.user_id === get("owner"))?.display_name ?? get("owner"));
    chips.push({ key: "owner", label: `${t("fields.agent")}: ${label}` });
  }
  if (get("priority")) {
    chips.push({ key: "priority", label: `${t("fields.priority")}: ${t(`status.task_priority.${get("priority")}`)}` });
  }
  if (get("product")) {
    chips.push({ key: "product", label: `${t("fields.product")}: ${products.find((p) => p.id === get("product"))?.name ?? get("product")}` });
  }
  if (overdueOn) chips.push({ key: "due", label: t("tasks.overdueOnly") });

  return (
    <div className="card-surface space-y-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.agent")}</span>
          <Select value={ownerValue} onValueChange={(v) => setParam("owner", v === currentUserId ? null : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentUserId}>{t("tasks.mine")}</SelectItem>
              <SelectItem value={ALL_OWNERS}>{t("common.all")}</SelectItem>
              {owners
                .filter((o) => o.user_id !== currentUserId)
                .map((o) => (
                  <SelectItem key={o.user_id} value={o.user_id}>
                    {o.display_name ?? o.user_id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.priority")}</span>
          <Select value={get("priority") || ALL_OWNERS} onValueChange={(v) => setParam("priority", v === ALL_OWNERS ? null : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OWNERS}>{t("common.all")}</SelectItem>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <SelectOptionRow label={t(`status.task_priority.${p}`)} token={TASK_PRIORITY_TOKEN[p]} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.product")}</span>
          <Select value={get("product") || ALL_OWNERS} onValueChange={(v) => setParam("product", v === ALL_OWNERS ? null : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OWNERS}>{t("common.all")}</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col justify-end gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("fields.due_date")}</span>
          <Button
            type="button"
            variant={overdueOn ? "default" : "outline"}
            size="sm"
            className="justify-start gap-1.5"
            onClick={() => setParam("due", overdueOn ? null : "overdue")}
          >
            <AlarmClockCheck className="h-3.5 w-3.5" />
            {t("tasks.overdueOnly")}
          </Button>
        </label>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setParam(c.key, c.key === "owner" ? currentUserId : null)}
              className="focus:outline-none"
            >
              <Chip token="neutral" size="sm" className="gap-1 hover:bg-neutral-bg/70">
                {c.label}
                <X className="h-3 w-3" />
              </Chip>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
