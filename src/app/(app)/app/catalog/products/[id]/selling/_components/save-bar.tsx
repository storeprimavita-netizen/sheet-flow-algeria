"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; reason: string };

/** Save button + live feedback shared by the three Selling editors: success, or the reason with a retry. */
export function SaveBar({ state, dirty, onSave }: { state: SaveState; dirty: boolean; onSave: () => void }) {
  const t = useTranslations("store.admin.selling");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" onClick={onSave} disabled={state.kind === "saving" || (!dirty && state.kind !== "error")}>
        {state.kind === "saving" ? t("saving") : t("save")}
      </Button>
      <p className="text-sm" aria-live="polite" role={state.kind === "error" ? "alert" : "status"}>
        {state.kind === "saved" && !dirty ? <span className="text-success">{t("saved")}</span> : null}
        {state.kind === "error" ? (
          <span className="inline-flex items-center gap-2 text-danger">
            {state.reason}
            <Button type="button" variant="outline" size="sm" onClick={onSave}>
              <RotateCw />
              {t("retry")}
            </Button>
          </span>
        ) : null}
        {dirty && state.kind !== "error" && state.kind !== "saving" ? <span className="text-muted-foreground">{t("unsaved")}</span> : null}
      </p>
    </div>
  );
}
