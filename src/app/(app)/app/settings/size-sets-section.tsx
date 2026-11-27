"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Empty } from "@/components/empty";
import { sizeSetSchema } from "@/lib/variants";
import { deleteSizeSet, saveSizeSet } from "./actions";

export type SizeSetRow = { id: string; name: string; items: string[] };

/** "S, M\nL" -> ["S","M","L"]: commas and new lines both separate names. */
const parseItems = (text: string) => text.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/** Settings -> Options: reusable lists of size names ("Use size set" in a product's options merges one in). Admin only. */
export function SizeSetsSection({ sets, error }: { sets: SizeSetRow[]; error: boolean }) {
  const t = useTranslations("settings.sizeSets");
  const router = useRouter();
  const [editing, setEditing] = React.useState<SizeSetRow | "new" | null>(null);
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SizeSetRow | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const cancelDeleteRef = React.useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = React.useRef<HTMLButtonElement>(null);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const focusAfterDeleteRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusAfterDeleteRef.current || (deleteTarget && sets.some((set) => set.id === deleteTarget.id))) return;
    focusAfterDeleteRef.current = false;
    (addButtonRef.current ?? headingRef.current)?.focus();
  }, [deleteTarget, sets]);

  function open(row: SizeSetRow | "new") {
    setEditing(row);
    setName(row === "new" ? "" : row.name);
    setText(row === "new" ? "" : row.items.join(", "));
    setFieldError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name, items: parseItems(text) };
    if (!sizeSetSchema.safeParse(input).success) return setFieldError(t("invalid"));
    setBusy(true);
    const res = await saveSizeSet(editing === "new" || !editing ? null : editing.id, input);
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      router.refresh();
    } else setFieldError(res.code === "duplicate" ? t("duplicate") : res.code === "invalid" ? t("invalid") : t("failed"));
  }

  async function remove() {
    if (!deleteTarget || deletePending) return;
    const row = deleteTarget;
    setDeleteError(null);
    setDeletePending(true);
    const res = await deleteSizeSet(row.id);
    setDeletePending(false);
    if (res.ok) {
      focusAfterDeleteRef.current = true;
      setDeleteTarget(null);
      router.refresh();
    } else setDeleteError(t("deleteFailed"));
  }

  return (
    <section className="card-surface space-y-4 rounded-xl p-5" aria-labelledby="size-sets-title" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 ref={headingRef} tabIndex={-1} id="size-sets-title" className="text-sm font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
        {!error && sets.length ? (
          <Button ref={addButtonRef} type="button" size="sm" variant="outline" onClick={() => open("new")}>
            <Plus />
            {t("add")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <span>{t("loadFailed")}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>{t("retry")}</Button>
        </div>
      ) : !sets.length && editing === null ? (
        <Empty>
          <p className="mb-3">{t("empty")}</p>
          <Button ref={addButtonRef} type="button" size="sm" onClick={() => open("new")}>
            <Plus />
            {t("add")}
          </Button>
        </Empty>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sets.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium"><bdi>{s.name}</bdi></p>
                <p className="text-xs text-muted-foreground" dir="ltr">{s.items.join(", ")}</p>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={t("edit", { name: s.name })} onClick={() => open(s)}>
                  <Pencil />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={t("delete", { name: s.name })} disabled={busy || deletePending} onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteError(null); setDeleteTarget(s); }}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deletePending) setDeleteTarget(null); }}>
        <DialogContent
          aria-busy={deletePending}
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelDeleteRef.current?.focus(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!focusAfterDeleteRef.current) deleteTriggerRef.current?.focus();
          }}
        >
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t.rich("deleteConfirm", { name: (chunks) => <bdi dir="auto">{chunks}</bdi> })}
          </DialogDescription>
          {deleteError ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{deleteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button ref={cancelDeleteRef} type="button" variant="outline" disabled={deletePending} onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <Button type="button" disabled={deletePending} onClick={remove}>{deletePending ? t("deleting") : deleteError ? t("retry") : t("confirmDelete")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {editing !== null ? (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("name")}</span>
            <Input value={name} maxLength={60} dir="auto" aria-invalid={!!fieldError} aria-describedby={fieldError ? "size-set-error" : undefined} onChange={(e) => { setName(e.target.value); setFieldError(null); }} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("items")}</span>
            <Textarea value={text} rows={3} dir="auto" placeholder="S, M, L, XL" onChange={(e) => { setText(e.target.value); setFieldError(null); }} />
            <span className="text-xs text-muted-foreground">{t("itemsHint")}</span>
          </label>
          {fieldError ? <p id="size-set-error" role="alert" className="text-xs text-danger">{fieldError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>{t("cancel")}</Button>
            <Button type="submit" disabled={busy}>{busy ? t("saving") : t("save")}</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
