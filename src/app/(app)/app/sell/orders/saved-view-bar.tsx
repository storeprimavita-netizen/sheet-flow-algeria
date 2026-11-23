"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { OrderViewDto, ViewConfig, ViewPresentation, ViewScope } from "@/lib/order-views";
import { createView, saveView } from "./views-actions";
import { ViewNameDialog } from "./view-name-dialog";

/** "Modified" bar for the active view + the live region that announces Saved / Reset. */
export function SavedViewBar({
  view,
  scope,
  effective,
  dirty,
  presentation,
  isAdmin,
  keep,
}: {
  view: OrderViewDto | null;
  scope: ViewScope;
  effective: ViewConfig;
  dirty: boolean;
  presentation: ViewPresentation;
  isAdmin: boolean;
  keep: string;
}) {
  const t = useTranslations("orderViews");
  const router = useRouter();
  const path = usePathname();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveAs, setSaveAs] = useState(false);
  const saveAsRef = useRef<HTMLButtonElement>(null);
  const canSave = !!view && (isAdmin || !view.shared);
  const withKeep = (qs: string) => `${path}?${[qs, keep].filter(Boolean).join("&")}`;
  const { layout, groupBy, cardFields } = presentation;
  const config = { ...effective, groupBy, cardFields };

  async function save() {
    if (!view) return;
    setBusy(true);
    const r = await saveView(view.id, config, layout);
    setBusy(false);
    setStatus(r.ok ? t("saved") : t(`error.${r.error}`));
    if (r.ok) router.refresh();
  }

  return (
    <>
      <p role="status" className="sr-only">
        {status}
      </p>
      {!view ? (
        <div className="flex justify-end">
          <Button ref={saveAsRef} type="button" size="sm" variant="outline" onClick={() => setSaveAs(true)}>
            {t("saveAsView")}
          </Button>
        </div>
      ) : null}
      {dirty && view ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span aria-hidden className="size-2 rounded-full bg-warning" />
          <span className="font-medium">{t("modified")}</span>
          <span className="text-xs text-muted-foreground">{t("discardHint")}</span>
          <span className="ms-auto flex gap-2">
            {canSave ? (
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                {t("save")}
              </Button>
            ) : null}
            <Button ref={saveAsRef} type="button" size="sm" variant="outline" onClick={() => setSaveAs(true)}>
              {isAdmin ? t("saveAs") : t("saveAsMine")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatus(t("resetDone"));
                router.replace(withKeep(`view=${view.id}`));
              }}
            >
              {t("reset")}
            </Button>
          </span>
        </div>
      ) : null}
      {saveAs ? (
        <ViewNameDialog
          open
          onOpenChange={setSaveAs}
          title={!view ? t("saveAsView") : isAdmin ? t("saveAs") : t("saveAsMine")}
          initial={{ name: "", emoji: "" }}
          canShare={isAdmin}
          submitLabel={t("save")}
          returnFocus={() => saveAsRef.current}
          onSubmit={async (v) => {
            const r = await createView({ name: v.name, emoji: v.emoji, scope, shared: isAdmin && v.shared, layout, config });
            if (r.ok) router.replace(withKeep(`view=${r.id}`));
            return r;
          }}
        />
      ) : null}
    </>
  );
}
