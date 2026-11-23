"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { offerSaving } from "@/lib/store/offer-price";
import { MAX_QUANTITY_OFFERS, reconcileOfferIds } from "@/lib/store/selling-schemas";

import { saveOffers } from "../actions";
import { SaveBar, type SaveState } from "./save-bar";

export type OfferRow = { id: string; label: string; qty: number; total: number; isDefault: boolean; isActive: boolean; activeFrom: string | null; activeTo: string | null };
type Bump = { productId: string | null; price: number; label: string; isActive: boolean };
type Candidate = { id: string; name: string; price: number };
type Row = { key: string; id: string | null; label: string; qty: number | null; total: number | null; isDefault: boolean; isActive: boolean; from: string; to: string };

// Algeria is UTC+1 all year: a calendar day maps to a fixed offset
const dayOf = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 10) : "");
const startOf = (d: string) => (d ? `${d}T00:00:00+01:00` : null);
const endOf = (d: string) => (d ? `${d}T23:59:59+01:00` : null);
const NONE = "__none";

export function OffersEditor({ productId, salePrice, offers, bump: initialBump, candidates }: { productId: string; salePrice: number | null; offers: OfferRow[]; bump: Bump | null; candidates: Candidate[] }) {
  const t = useTranslations("store.admin.selling");
  const [rows, setRows] = React.useState<Row[]>(() => offers.map((o) => ({ key: o.id, id: o.id, label: o.label, qty: o.qty, total: o.total, isDefault: o.isDefault, isActive: o.isActive, from: dayOf(o.activeFrom), to: dayOf(o.activeTo) })));
  const [bump, setBump] = React.useState<Bump | null>(initialBump);
  const [state, setState] = React.useState<SaveState>({ kind: "idle" });
  const [dirty, setDirty] = React.useState(false);
  const editRevision = React.useRef(0);
  const touch = () => {
    editRevision.current += 1;
    setDirty(true);
    setState((s) => (s.kind === "saved" ? { kind: "idle" } : s));
  };
  const patch = (key: string, p: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : p.isDefault ? { ...r, isDefault: false } : r)));
    touch();
  };
  const move = (i: number, by: -1 | 1) => {
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
    touch();
  };

  async function save() {
    if (rows.some((r) => r.qty === null || r.total === null || !r.label.trim())) {
      setState({ kind: "error", reason: t("offers.incomplete") });
      return;
    }
    if (bump && bump.productId && (!bump.price || !bump.label.trim())) {
      setState({ kind: "error", reason: t("offers.bumpIncomplete") });
      return;
    }
    setState({ kind: "saving" });
    const submittedRevision = editRevision.current;
    const submittedKeys = rows.map((r) => r.key);
    try {
      const res = await saveOffers({
        productId,
        offers: rows.map((r) => ({ id: r.id, label: r.label.trim(), qty: r.qty, total: r.total, isDefault: r.isDefault, isActive: r.isActive, activeFrom: startOf(r.from), activeTo: endOf(r.to) })),
        bump: bump && bump.productId ? { productId: bump.productId, price: bump.price, label: bump.label.trim(), isActive: bump.isActive } : null,
      });
      if (!res.ok) {
        setState({ kind: "error", reason: t(`errors.${res.error}`) });
        return;
      }
      setRows((current) => reconcileOfferIds(current, submittedKeys, res.offerIds));
      const editedDuringSave = editRevision.current !== submittedRevision;
      setState({ kind: editedDuringSave ? "idle" : "saved" });
      setDirty(editedDuringSave);
    } catch {
      setState({ kind: "error", reason: t("errors.failed") });
    }
  }

  return (
    <section className="card-surface space-y-5 rounded-xl p-5" aria-labelledby="offers-title">
      <div className="space-y-1">
        <h3 id="offers-title" className="text-sm font-semibold">{t("offers.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("offers.hint")}</p>
      </div>

      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("offers.empty")}</p> : null}

      <ul className="space-y-3">
        {rows.map((r, i) => {
          const name = r.label || t("offers.unnamed", { n: i + 1 });
          const saving = salePrice !== null && r.qty && r.total ? offerSaving(salePrice, { qty: r.qty, total: r.total }) : null;
          return (
            <li key={r.key} className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_10rem]">
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  {t("offers.label")}
                  <Input value={r.label} maxLength={60} onChange={(e) => patch(r.key, { label: e.target.value })} />
                </label>
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  {t("offers.qty")}
                  <NumberField integer defaultValue={r.qty} onChange={(n) => patch(r.key, { qty: n !== null && Number.isFinite(n) ? n : null })} />
                </label>
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  {t("offers.total")}
                  <NumberField integer unit="DZD" defaultValue={r.total} onChange={(n) => patch(r.key, { total: n !== null && Number.isFinite(n) ? n : null })} />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <span>{t("offers.from")}</span>
                  <DateField value={r.from} onChange={(v) => patch(r.key, { from: v })} />
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <span>{t("offers.to")}</span>
                  <DateField value={r.to} onChange={(v) => patch(r.key, { to: v })} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-6">
                  <SettingSwitch label={t("offers.default")} checked={r.isDefault} onCheckedChange={(v) => patch(r.key, { isDefault: v })} />
                  <SettingSwitch label={t("offers.active")} checked={r.isActive} onCheckedChange={(v) => patch(r.key, { isActive: v })} />
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} aria-label={t("offers.moveUp", { name })} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === rows.length - 1} aria-label={t("offers.moveDown", { name })} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button type="button" variant="destructive" size="icon" aria-label={t("offers.remove", { name })} onClick={() => { if (window.confirm(t("offers.removeConfirm", { name }))) { setRows((rs) => rs.filter((x) => x.key !== r.key)); touch(); } }}><Trash2 /></Button>
                </div>
              </div>
              {saving !== null ? (
                <p className={`num text-xs ${saving > 0 ? "text-muted-foreground" : "text-warning"}`}>
                  {saving > 0 ? t("offers.saves", { n: formatCurrency(saving, "DZD") }) : t("offers.savesNothing")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" size="sm" disabled={rows.length >= MAX_QUANTITY_OFFERS} onClick={() => { setRows((rs) => [...rs, { key: crypto.randomUUID(), id: null, label: "", qty: null, total: null, isDefault: false, isActive: true, from: "", to: "" }]); touch(); }}>
        <Plus />
        {rows.length >= MAX_QUANTITY_OFFERS ? t("offers.max", { n: MAX_QUANTITY_OFFERS }) : t("offers.add")}
      </Button>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">{t("offers.bumpTitle")}</h4>
          <p className="text-xs text-muted-foreground">{t("offers.bumpHint")}</p>
        </div>
        {candidates.length === 0 ? <p className="text-sm text-muted-foreground">{t("offers.bumpNoCandidates")}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_10rem]">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <span id="bump-product">{t("offers.bumpProduct")}</span>
            <EnumSelect
              value={bump?.productId ?? NONE}
              options={[{ value: NONE, label: t("offers.bumpNone") }, ...candidates.map((c) => ({ value: c.id, label: c.name }))]}
              onChange={(v) => {
                const c = candidates.find((x) => x.id === v);
                setBump(v === NONE ? null : { productId: v, price: bump?.price ?? c?.price ?? 0, label: bump?.label || c?.name || "", isActive: bump?.isActive ?? true });
                touch();
              }}
            />
          </div>
          {bump ? (
            <>
              <label className="space-y-1.5 text-xs text-muted-foreground">
                {t("offers.bumpLabel")}
                <Input value={bump.label} maxLength={60} onChange={(e) => { setBump({ ...bump, label: e.target.value }); touch(); }} />
              </label>
              <label className="space-y-1.5 text-xs text-muted-foreground">
                {t("offers.bumpPrice")}
                <NumberField integer unit="DZD" defaultValue={bump.price} onChange={(n) => { setBump({ ...bump, price: n !== null && Number.isFinite(n) ? n : 0 }); touch(); }} />
              </label>
            </>
          ) : null}
        </div>
        {bump ? <SettingSwitch label={t("offers.active")} checked={bump.isActive} onCheckedChange={(v) => { setBump({ ...bump, isActive: v }); touch(); }} /> : null}
      </div>

      <SaveBar state={state} dirty={dirty} onSave={save} />
    </section>
  );
}
