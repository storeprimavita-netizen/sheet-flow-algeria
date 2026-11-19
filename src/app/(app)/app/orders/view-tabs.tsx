"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isUnrenamedSeed, serializeConfig, type OrderViewDto, type ViewConfig, type ViewScope } from "@/lib/order-views";
import { SavedViewBar } from "./saved-view-bar";
import { ViewNameDialog } from "./view-name-dialog";
import { createView, deleteView, moveView, renameView } from "./views-actions";

type Props = {
  scope: ViewScope;
  views: OrderViewDto[];
  activeId: string | null;
  effective: ViewConfig;
  dirty: boolean;
  isAdmin: boolean;
  loadError: boolean;
  /** extra params that survive a view switch (e.g. `show=all`) */
  keep: string;
};

const pill =
  "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm md:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ViewTabs({ scope, views, activeId, effective, dirty, isAdmin, loadError, keep }: Props) {
  const t = useTranslations("orderViews");
  const router = useRouter();
  const path = usePathname();
  const defaultRef = useRef<HTMLAnchorElement>(null);
  const focusDefault = useRef(false);
  const [rename, setRename] = useState<OrderViewDto | null>(null);
  const [saveAsFrom, setSaveAsFrom] = useState<OrderViewDto | null>(null);
  const [del, setDel] = useState<OrderViewDto | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const [note, setNote] = useState("");

  const shared = views.filter((v) => v.shared);
  const personal = views.filter((v) => !v.shared);
  const active = views.find((v) => v.id === activeId) ?? null;
  const label = (v: OrderViewDto) => (isUnrenamedSeed(v) ? t(`seed.${v.seed_key}`) : v.name);
  const href = (qs: string) => `${path}${[qs, keep].filter(Boolean).length ? `?${[qs, keep].filter(Boolean).join("&")}` : ""}`;

  useEffect(() => {
    document.querySelector('[data-view-strip] [aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
    if (!activeId && focusDefault.current) {
      focusDefault.current = false;
      defaultRef.current?.focus();
    }
  }, [activeId]);

  async function copyLink(v: OrderViewDto) {
    const qs = v.shared ? `view=${v.id}` : serializeConfig(v.id === activeId ? effective : v.config).toString();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href(qs)}`);
      setNote(t("linkCopied"));
    } catch {
      setNote(t("error.failed"));
    }
  }

  function renderView(v: OrderViewDto, i: number, group: OrderViewDto[]) {
    const isActive = v.id === activeId;
    const canEdit = isAdmin || !v.shared;
    return (
      <li key={v.id} className="flex shrink-0 items-center">
        <Link
          href={href(`view=${v.id}`)}
          aria-current={isActive ? "page" : undefined}
          className={cn(pill, "pe-1", isActive ? "border-primary bg-accent font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
        >
          {v.emoji ? <span aria-hidden>{v.emoji}</span> : null}
          <bdi>{label(v)}</bdi>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              ref={(el) => {
                if (el) triggers.current.set(v.id, el);
              }}
              aria-label={t("menuFor", { name: label(v) })}
              className="-ms-1 grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={() => setRename(v)}>{t("rename")}</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={i === 0}
                  onSelect={async () => {
                    const r = await moveView(v.id, "earlier");
                    if (r.ok) router.refresh();
                  }}
                >
                  {t("moveEarlier")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={i === group.length - 1}
                  onSelect={async () => {
                    const r = await moveView(v.id, "later");
                    if (r.ok) router.refresh();
                  }}
                >
                  {t("moveLater")}
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => setSaveAsFrom(v)}>{t("saveAsMine")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copyLink(v)}>{t("copyLink")}</DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => { setDelError(null); setDel(v); }}>
                  {t("delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  return (
    <div className="space-y-2">
      <div className="[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
        <nav aria-label={t("views")} data-view-strip className="overflow-x-auto px-3 py-1 [scrollbar-width:none]">
          <ul className="flex items-center gap-1">
            <li className="shrink-0">
              <Link
                ref={defaultRef}
                href={href("")}
                aria-current={!activeId ? "page" : undefined}
                className={cn(pill, !activeId ? "border-primary bg-accent font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {t("default")}
              </Link>
            </li>
            {shared.length ? (
              <li aria-hidden className="flex shrink-0 items-center ps-2 text-muted-foreground">
                <Users className="size-4" aria-label={t("shared")} />
              </li>
            ) : null}
            {shared.map(renderView)}
            {shared.length && personal.length ? <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" /> : null}
            {personal.map(renderView)}
          </ul>
        </nav>
      </div>

      {loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("loadError")}
          <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
            {t("retry")}
          </Button>
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {note}
      </p>

      <SavedViewBar view={active} scope={scope} effective={effective} dirty={dirty} isAdmin={isAdmin} keep={keep} />

      {rename ? (
        <ViewNameDialog
          open
          onOpenChange={(o) => !o && setRename(null)}
          title={t("rename")}
          initial={{ name: rename.name, emoji: rename.emoji ?? "" }}
          canShare={false}
          submitLabel={t("save")}
          returnFocus={() => triggers.current.get(rename.id) ?? null}
          onSubmit={async (v) => {
            const r = await renameView(rename.id, { name: v.name, emoji: v.emoji });
            if (r.ok) router.refresh();
            return r;
          }}
        />
      ) : null}
      {saveAsFrom ? (
        <ViewNameDialog
          open
          onOpenChange={(o) => !o && setSaveAsFrom(null)}
          title={t("saveAsMine")}
          initial={{ name: "", emoji: saveAsFrom.emoji ?? "" }}
          canShare={false}
          submitLabel={t("save")}
          returnFocus={() => triggers.current.get(saveAsFrom.id) ?? null}
          onSubmit={async (v) => {
            const r = await createView({ name: v.name, emoji: v.emoji, scope, shared: false, config: saveAsFrom.config });
            if (r.ok) router.replace(href(`view=${r.id}`));
            return r;
          }}
        />
      ) : null}
      {del ? (
        <Dialog open onOpenChange={(o) => !o && setDel(null)}>
          <DialogContent
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              (focusDefault.current ? defaultRef.current : triggers.current.get(del.id))?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("delete")}</DialogTitle>
              <DialogDescription>{t("deleteConfirm", { name: label(del) })}</DialogDescription>
            </DialogHeader>
            <p role="alert" className={cn("text-sm text-danger", !delError && "hidden")}>
              {delError}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDel(null)}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const r = await deleteView(del.id);
                  if (!r.ok) return setDelError(t(`error.${r.error}`));
                  if (del.id === activeId) {
                    focusDefault.current = true;
                    router.replace(href(""));
                  } else router.refresh();
                  setDel(null);
                }}
              >
                {delError ? t("retry") : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** Shown when `?view` cannot be used (junk, other scope, someone else's, deleted): no existence leak. */
export function InvalidViewNotice({ rest }: { rest: string }) {
  const t = useTranslations("orderViews");
  const path = usePathname();
  const [open, setOpen] = useState(true);
  // strip the unusable ?view from the URL right away; the notice stays until dismissed
  useEffect(() => {
    // history API only: a router navigation would re-render the page and drop the notice
    window.history.replaceState(null, "", `${path}${rest ? `?${rest}` : ""}`);
  }, [path, rest]);
  if (!open) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      {t("notAvailable")}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ms-auto"
        onClick={() => setOpen(false)}
      >
        {t("dismiss")}
      </Button>
    </p>
  );
}
