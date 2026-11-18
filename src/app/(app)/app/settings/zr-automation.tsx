"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { StatusPill } from "@/components/status-pill";
import { allStatuses } from "@/lib/statuses";
import { MANUAL_DELIVERY_STATUSES } from "@/lib/enums";
import { saveZRStateMap, setZRAutoPush, syncZRFees } from "./actions";

const NONE = "__none";

/** ZR → order status mapping, auto-push toggle, fee sync. Client side of ZRExpressSection. */
export function ZRAutomation({
  seenStates,
  map,
  autoPush,
}: {
  seenStates: string[];
  map: Record<string, string>;
  autoPush: boolean;
}) {
  const t = useTranslations("settings.zrexpress");
  const tAll = useTranslations();
  const router = useRouter();
  const [rows, setRows] = React.useState(() => {
    const keys = new Map<string, string>();
    for (const s of seenStates) keys.set(s.trim().toLowerCase(), s.trim());
    for (const k of Object.keys(map)) if (!keys.has(k)) keys.set(k, k);
    return [...keys].map(([key, label]) => ({ label, status: map[key] ?? NONE }));
  });
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState<"map" | "fees" | null>(null);

  async function save() {
    setBusy("map");
    const res = await saveZRStateMap(rows.filter((r) => r.status !== NONE).map((r) => ({ state: r.label, status: r.status })));
    setBusy(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(tAll("common.updated"));
      router.refresh();
    }
  }

  async function sync() {
    setBusy("fees");
    const res = await syncZRFees();
    setBusy(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(t("feesSynced", { n: res.updated }));
      router.refresh();
    }
  }

  return (
    <div className="space-y-5 border-t border-border pt-4">
      <SettingSwitch
        label={t("autoPush")}
        description={t("autoPushHint")}
        defaultChecked={autoPush}
        onCheckedChange={async (v) => {
          const res = await setZRAutoPush(v);
          if (!res.ok) toast.error(res.error);
        }}
      />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">{t("stateMapTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("stateMapHint")}</p>
        </div>
        {rows.length === 0 ? <p className="text-xs text-faint">{t("noStates")}</p> : null}
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r, i) => (
            <li key={r.label} className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_14rem]">
              <span className="truncate text-sm">{r.label}</span>
              <Select value={r.status} onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, status: v } : x)))}>
                <SelectTrigger>
                  {/* explicit content: Radix leaves SelectValue blank until items mount */}
                  <SelectValue>
                    {r.status === NONE ? (
                      <span className="text-muted-foreground">{t("notMapped")}</span>
                    ) : (
                      <StatusPill kind="delivery" status={r.status} size="sm" />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-muted-foreground">{t("notMapped")}</span>
                  </SelectItem>
                  {allStatuses("delivery").filter((s) => (MANUAL_DELIVERY_STATUSES as readonly string[]).includes(s.key)).map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      <StatusPill kind="delivery" status={s.key} size="sm" />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("addState")}
            autoComplete="off"
            className="max-w-64"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!draft.trim() || rows.some((r) => r.label.toLowerCase() === draft.trim().toLowerCase())}
            onClick={() => {
              setRows((rs) => [...rs, { label: draft.trim(), status: NONE }]);
              setDraft("");
            }}
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={busy === "map"}>
            {busy === "map" ? tAll("actions.saving") : t("saveMap")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={sync} disabled={busy === "fees"}>
          <RefreshCw className={busy === "fees" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("syncFees")}
        </Button>
      </div>
    </div>
  );
}
