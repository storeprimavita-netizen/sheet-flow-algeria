"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ExternalLink, Eye, ImageIcon, Lock, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ButtonLink } from "@/components/button-link";
import { Field } from "@/components/field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Block } from "@/lib/store/blocks";

import { linkPageProduct, publishPage, savePage, unpublishPage, type StoreResult } from "../actions";

type Row = { id: string; block: Block };
type Seo = { title: string; description: string; image: string };
type Props = {
  page: { id: string; title: string; slug: string; status: string; productId: string | null; productOk: boolean; blocks: Block[]; seo: Partial<Seo> };
  store: { slug: string; status: string };
  products: { id: string; name: string }[];
};

// deterministic ids: identical on server and client, so hydration matches
const toRows = (blocks: Block[]): Row[] => blocks.map((block, i) => ({ id: `r${i}`, block }));
const toSeo = (s: Props["page"]["seo"]): Seo => ({ title: s.title ?? "", description: s.description ?? "", image: s.image ?? "" });
const cleanSeo = (s: Seo) => Object.fromEntries(Object.entries(s).filter(([, v]) => v.trim() !== "")) as Partial<Seo>;
const snapshot = (title: string, slug: string, rows: Row[], seo: Seo) => JSON.stringify({ title, slug, blocks: rows.map((r) => r.block), seo });

export function PageEditor({ page, store, products }: Props) {
  const t = useTranslations("store.admin.editor");
  const tp = useTranslations("store.admin.pages");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [rows, setRows] = useState<Row[]>(() => toRows(page.blocks));
  const [seo, setSeo] = useState<Seo>(() => toSeo(page.seo));
  const [saved, setSaved] = useState(() => snapshot(page.title, page.slug, toRows(page.blocks), toSeo(page.seo)));
  const [status, setStatus] = useState(page.status);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const nextId = useRef(page.blocks.length);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const publishBtn = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<{ id: string; dir: "up" | "down" } | null>(null);

  const dirty = useMemo(() => snapshot(title, slug, rows, seo) !== saved, [title, slug, rows, seo, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // keep keyboard focus on the button that moved a block
  useEffect(() => {
    const f = focusRef.current;
    if (!f) return;
    focusRef.current = null;
    document.getElementById(`blk-${f.id}-${f.dir}`)?.focus();
  }, [rows]);

  const errMsg = (r: Extract<StoreResult, { ok: false }>) =>
    r.error === "slug_taken" ? t("errSlugTaken") : r.error === "product_taken" ? t("errProductTaken") : r.error === "invalid" ? t("errInvalid") : r.error === "needs_product" ? t("errNeedsProduct") : t("errFailed");

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    focusRef.current = { id: rows[i].id, dir: d === -1 ? "up" : "down" };
    setRows(next);
    setLive(t("movedTo", { n: j + 1 }));
  }
  const update = (id: string, block: Block) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, block } : r)));
  const add = (type: Block["type"]) => {
    const block: Block =
      type === "heading" ? { type, text: "" } : type === "text" ? { type, text: "" } : type === "image" ? { type, url: "", alt: "" } : { type: "list", items: [""] };
    setRows((rs) => [...rs, { id: `r${nextId.current++}`, block }]);
  };

  function save() {
    start(async () => {
      const r = await savePage({ id: page.id, title, slug, blocks: rows.map((x) => x.block), seo: cleanSeo(seo) });
      if (r.ok) {
        setError(null);
        setSaved(snapshot(title, slug, rows, seo));
        toast.success(t("saved"));
        router.refresh();
      } else {
        // input stays; the button is the retry
        setError(`${errMsg(r)} ${t("saveFailed")}`);
      }
    });
  }

  function togglePublish() {
    setConfirmOpen(false);
    start(async () => {
      const r = status === "published" ? await unpublishPage(page.id) : await publishPage(page.id);
      if (r.ok) {
        setError(null);
        setStatus(status === "published" ? "draft" : "published");
        toast.success(status === "published" ? t("unpublished") : t("published"));
        router.refresh();
      } else setError(errMsg(r));
    });
  }

  function link(productId: string | null) {
    start(async () => {
      const r = await linkPageProduct(page.id, productId);
      if (r.ok) router.refresh();
      else setError(errMsg(r));
    });
  }

  const published = status === "published";
  const publishReason = !page.productId ? t("publishNeedsProduct") : !page.productOk ? t("publishProductNotReady") : dirty ? t("publishNeedsSave") : null;
  const liveReason = store.status !== "live" ? t("viewLiveDisabledStore") : !published ? t("viewLiveDisabledPage") : null;
  const lockedRow = (label: string) => (
    <li className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
      <Lock className="h-4 w-4" aria-hidden="true" />
      {label}
    </li>
  );
  const typeLabel = (b: Block) =>
    b.type === "heading" ? t("typeHeading") : b.type === "text" ? t("typeText") : b.type === "image" ? t("typeImage") : b.type === "list" ? t("typeList") : t("typeRelated");

  return (
    <div className="space-y-6">
      <div className="card-surface sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl p-3">
        <StatusPill kind="store" status={status} />
        <span className="text-sm text-muted-foreground" role="status">
          {dirty ? t("dirty") : ""}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <ButtonLink href={`/app/store/pages/${page.id}/preview`} variant="outline" size="sm">
            <Eye className="h-4 w-4" />
            {t("preview")}
          </ButtonLink>
          {liveReason ? (
            <span title={liveReason}>
              <Button type="button" variant="outline" size="sm" disabled aria-label={`${t("viewLive")}. ${liveReason}`}>
                <ExternalLink className="h-4 w-4" />
                {t("viewLive")}
              </Button>
            </span>
          ) : (
            <ButtonLink href={`/s/${store.slug}/${page.slug}`} variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" />
              {t("viewLive")}
            </ButtonLink>
          )}
          <span title={publishReason ?? undefined}>
            <Button ref={publishBtn} type="button" variant={published ? "outline" : "default"} size="sm" disabled={pending || (!published && publishReason !== null)} onClick={published ? () => setConfirmOpen(true) : togglePublish}>
              {published ? t("unpublish") : t("publish")}
            </Button>
          </span>
          <Button type="button" size="sm" disabled={pending || !dirty} onClick={save}>
            <Save className="h-4 w-4" />
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
      {!published && publishReason ? <p className="text-sm text-muted-foreground">{publishReason}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="card-surface space-y-4 rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={tp("fieldTitle")} htmlFor="pe-title">
            <Input id="pe-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={tp("fieldSlug")} htmlFor="pe-slug">
            <Input id="pe-slug" value={slug} dir="ltr" maxLength={40} autoCapitalize="none" spellCheck={false} onChange={(e) => setSlug(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("product")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Combobox
              className="min-w-64"
              ariaLabel={t("product")}
              value={page.productId ?? ""}
              onChange={(v) => link(v)}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={t("linkProduct")}
              searchPlaceholder={tp("searchProduct")}
              emptyText={tp("noProductsFound")}
              disabled={pending}
            />
            {page.productId ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending || published} onClick={() => link(null)}>
                {t("unlink")}
              </Button>
            ) : null}
            {page.productId && published ? <span className="text-xs text-muted-foreground">{t("errNeedsProduct")}</span> : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("blocks")}</h2>
        <ul className="space-y-2">
          {lockedRow(t("lockedGallery"))}
          {lockedRow(t("lockedTitle"))}
          {lockedRow(t("lockedOrder"))}
          {rows.map((r, i) => (
            <li key={r.id} className="card-surface space-y-3 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{typeLabel(r.block)}</span>
                <div className="ms-auto flex items-center gap-1">
                  <Button id={`blk-${r.id}-up`} type="button" variant="ghost" size="icon" aria-label={`${t("up")}: ${typeLabel(r.block)} ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button id={`blk-${r.id}-down`} type="button" variant="ghost" size="icon" aria-label={`${t("down")}: ${typeLabel(r.block)} ${i + 1}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`${t("remove")}: ${typeLabel(r.block)} ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {r.block.type === "heading" ? (
                <Field label={`${t("fieldText")} · ${typeLabel(r.block)} ${i + 1}`} htmlFor={`b-${r.id}`}>
                  <Input id={`b-${r.id}`} value={r.block.text} maxLength={120} onChange={(e) => update(r.id, { type: "heading", text: e.target.value })} />
                </Field>
              ) : null}
              {r.block.type === "text" ? (
                <Field label={`${t("fieldText")} · ${typeLabel(r.block)} ${i + 1}`} htmlFor={`b-${r.id}`}>
                  <Textarea id={`b-${r.id}`} rows={4} value={r.block.text} maxLength={2000} onChange={(e) => update(r.id, { type: "text", text: e.target.value })} />
                </Field>
              ) : null}
              {r.block.type === "image" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("fieldUrl")} htmlFor={`b-${r.id}`}>
                    <Input id={`b-${r.id}`} value={r.block.url} dir="ltr" inputMode="url" onChange={(e) => update(r.id, { ...(r.block as Extract<Block, { type: "image" }>), url: e.target.value })} />
                  </Field>
                  <Field label={t("fieldAlt")} htmlFor={`b-${r.id}-alt`}>
                    <Input id={`b-${r.id}-alt`} value={r.block.alt} maxLength={200} onChange={(e) => update(r.id, { ...(r.block as Extract<Block, { type: "image" }>), alt: e.target.value })} />
                  </Field>
                </div>
              ) : null}
              {r.block.type === "list" ? (
                <Field label={t("fieldItems")} htmlFor={`b-${r.id}`}>
                  <Textarea id={`b-${r.id}`} rows={4} value={r.block.items.join("\n")} onChange={(e) => update(r.id, { type: "list", items: e.target.value.split("\n") })} />
                </Field>
              ) : null}
            </li>
          ))}
        </ul>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("noBlocks")}</p> : null}
        <div className="flex flex-wrap gap-2">
          {(["heading", "text", "image", "list"] as const).map((type) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => add(type)}>
              {type === "image" ? <ImageIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {t(type === "heading" ? "addHeading" : type === "text" ? "addText" : type === "image" ? "addImage" : "addList")}
            </Button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </section>

      <section className="card-surface space-y-4 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold">{t("seo")}</h2>
          <p className="text-sm text-muted-foreground">{t("seoHint")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("seoTitle")} htmlFor="pe-seo-title">
            <Input id="pe-seo-title" value={seo.title} maxLength={120} onChange={(e) => setSeo({ ...seo, title: e.target.value })} />
          </Field>
          <Field label={t("seoImage")} htmlFor="pe-seo-image">
            <Input id="pe-seo-image" value={seo.image} dir="ltr" inputMode="url" onChange={(e) => setSeo({ ...seo, image: e.target.value })} />
          </Field>
          <Field label={t("seoDescription")} htmlFor="pe-seo-desc" className="md:col-span-2">
            <Textarea id="pe-seo-desc" rows={2} value={seo.description} maxLength={300} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
          </Field>
        </div>
      </section>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            // controlled dialog has no trigger: give focus back to the Unpublish button ourselves
            e.preventDefault();
            publishBtn.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("unpublishTitle")}</DialogTitle>
            <DialogDescription>{t("unpublishBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={togglePublish} disabled={pending}>
              {t("unpublish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
