"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Power, PowerOff, Trash2, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tableClass } from "@/components/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SwatchDot, SwatchField } from "@/components/fields/swatch-field";
import { isSizeOption, mergeSizeSet, missingCombos, skuSuggestion, variantLabel, type OptionKind, type VariantOption } from "@/lib/variants";
import { BackfillDialog, type OptionDraft, type SizeSetDTO } from "./backfill-dialog";
import { saveVariantConfig, type VariantResult } from "../actions";

type EditorVariant = { id: string; sku: string; isActive: boolean; stock: number; values: Record<string, string>; saved: boolean };

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const newId = () => crypto.randomUUID();

/** Options (Size, Color…), their values and the sizes built from them. Stock is read-only here: it moves only on the stock page. */
export function VariantsEditor({
  productId,
  initialOptions,
  initialVariants,
  productCode,
  sizeSets,
}: {
  productCode: string;
  /** admin-scoped (RLS) list; null = the viewer is not an admin, so "Use size set" is hidden */
  sizeSets: SizeSetDTO[] | null;
  productId: string;
  initialOptions: VariantOption[];
  initialVariants: { id: string; sku: string | null; isActive: boolean; stock: number; values: Record<string, string> }[];
}) {
  const t = useTranslations("variants");
  const router = useRouter();
  const [options, setOptions] = React.useState<VariantOption[]>(initialOptions);
  const [variants, setVariants] = React.useState<EditorVariant[]>(
    initialVariants.map((v) => ({ ...v, sku: v.sku ?? "", saved: true })),
  );
  const [busy, setBusy] = React.useState(false);
  const [backfill, setBackfill] = React.useState<Record<string, string>>({});
  const [savedOptionIds, setSavedOptionIds] = React.useState(() => new Set(initialOptions.map((o) => o.id)));
  const [adding, setAdding] = React.useState<{ kind: OptionKind; name: string } | null>(null);
  const [unsaved, setUnsaved] = React.useState(false);
  const [result, setResult] = React.useState<VariantResult | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = React.useState<number | null>(null);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  const lastDeactivated = React.useRef<string | null>(null);
  const openerRef = React.useRef("add-missing");
  React.useEffect(() => {
    if (!focusKey) return;
    document.querySelector<HTMLElement>(`[data-fk="${focusKey}"]`)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const dirty = () => { setResult(null); setUnsaved(true); };
  const toggleActive = (i: number) => {
    dirty();
    setVariants((vs) => vs.map((x, k) => (k === i ? { ...x, isActive: !x.isActive } : x)));
  };

  // a saved option cannot be removed while saved sizes exist (stale); new options always can
  const hasSaved = variants.some((v) => v.saved);
  const hasColor = options.some((o) => o.kind === "color");
  const lockedOption = (o: VariantOption) => hasSaved && savedOptionIds.has(o.id);
  const optName = (o: VariantOption, i: number) => o.name || t("optionFallback", { n: i + 1 });

  const setOption = (i: number, patch: Partial<VariantOption>) => {
    dirty();
    setOptions((os) => os.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  };
  const setValue = (i: number, j: number, label: string) =>
    setOption(i, { values: options[i].values.map((v, k) => (k === j ? { ...v, label } : v)) });

  function addMissing() {
    dirty();
    const combos = missingCombos(
      options.map((o) => ({ ...o, values: o.values.filter((v) => v.label.trim()) })),
      variants.map((v) => v.values),
    );
    setVariants((vs) => [...vs, ...combos.map((values) => ({ id: newId(), sku: "", isActive: true, stock: 0, values, saved: false }))]);
  }

  const payload = (opts: VariantOption[], vars: EditorVariant[], back: Record<string, string>) => ({
    options: opts.map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind ?? "text",
      values: o.values.map((v) => ({ id: v.id, label: v.label, swatch_color: v.swatchColor ?? null, swatch_image: v.swatchImage ?? null })),
    })),
    variants: vars.map((v) => ({ id: v.id, sku: v.sku.trim() || null, is_active: v.isActive, existing: v.saved, values: v.values })),
    // only options that are new to the database carry a backfill value
    backfill: Object.fromEntries(Object.entries(back).filter(([id]) => opts.some((o) => o.id === id) && !savedOptionIds.has(id))),
  });

  function afterSave(opts: VariantOption[]) {
    setUnsaved(false);
    setBackfill({});
    setSavedOptionIds(new Set(opts.map((o) => o.id)));
    setVariants((vs) => vs.map((v) => ({ ...v, saved: true })));
    router.refresh();
  }

  async function save() {
    setBusy(true);
    setResult(null);
    const res = await saveVariantConfig(productId, payload(options, variants, backfill));
    setBusy(false);
    setResult(res);
    if (res.ok) afterSave(options);
  }

  /** "+ Size" / "+ Color" / "Add option": straight in when no saved size exists, else through the backfill dialog. */
  function startAdd(kind: OptionKind, name: string, opener: string) {
    if (hasSaved) {
      openerRef.current = opener;
      return setAdding({ kind, name });
    }
    dirty();
    setOptions([...options, { id: newId(), name, kind, values: [{ id: newId(), label: "" }] }]);
  }

  /** Dialog confirm: save with the new option and every existing size copied to the chosen value; state changes only on success. */
  async function confirmAdd(d: OptionDraft): Promise<VariantResult> {
    const opt: VariantOption = { id: newId(), name: d.name, kind: d.kind, values: d.values.map((v) => ({ ...v })) };
    const nextOptions = [...options, opt];
    const nextVariants = variants.map((v) => (v.saved ? { ...v, values: { ...v.values, [opt.id]: d.backfillId } } : v));
    const nextBackfill = { ...backfill, [opt.id]: d.backfillId };
    const res = await saveVariantConfig(productId, payload(nextOptions, nextVariants, nextBackfill));
    if (res.ok) {
      setOptions(nextOptions);
      setVariants(nextVariants);
      setResult(res);
      afterSave(nextOptions);
      setAdding(null);
      setFocusKey("add-missing"); // the opener may be disabled now (size/color added)
    }
    return res;
  }

  const combos = options.reduce((n, o) => n * Math.max(o.values.filter((v) => v.label.trim()).length, 1), 1);
  const comboFormula = options.map((o) => o.values.filter((v) => v.label.trim()).length).join(" × ");
  const fillSkus = () => {
    dirty();
    const taken = new Set(variants.map((v) => v.sku.trim()).filter(Boolean));
    setVariants(
      variants.map((v) => {
        if (v.sku.trim()) return v;
        const parts = options.map((o) => {
          const idx = o.values.findIndex((x) => x.id === v.values[o.id]);
          return { label: o.values[idx]?.label ?? "", index: Math.max(idx, 0) };
        });
        const sku = skuSuggestion(productCode, parts, taken);
        taken.add(sku);
        return { ...v, sku };
      }),
    );
  };

  const message = result
    ? result.ok
      ? t("saved")
      : result.code === "duplicate_value"
        ? t("duplicateValue")
        : result.code === "duplicate_variant"
          ? t("duplicateVariant")
          : result.code === "in_use"
            ? t("inUse")
            : result.code === "stale"
              ? t("stale")
            : result.code === "invalid"
              ? t("invalid")
              : t("failed", { reason: result.error })
    : null;

  return (
    <section className="card-surface space-y-5 rounded-xl p-5" aria-labelledby="variants-title" aria-busy={busy}>
      <div className="space-y-1">
        <h2 id="variants-title" className="text-sm font-semibold">
          {options.length > 1 ? t("titleVariants") : t("titleSizes")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      {!options.length ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("empty")}</p> : null}

      <div className="space-y-4">
        {options.map((o, i) => (
          <fieldset key={o.id} className="space-y-3 rounded-lg border border-border p-3">
            <legend className="sr-only">{optName(o, i)}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={t("optionName")}
                value={o.name}
                maxLength={60}
                className="max-w-56"
                onChange={(e) => setOption(i, { name: e.target.value })}
              />
              <Button type="button" variant="ghost" size="icon" aria-label={t("moveOptionUp", { name: optName(o, i) })} disabled={i === 0} onClick={() => { dirty(); setOptions(move(options, i, -1)); }}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t("moveOptionDown", { name: optName(o, i) })} disabled={i === options.length - 1} onClick={() => { dirty(); setOptions(move(options, i, 1)); }}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t("removeOption", { name: optName(o, i) })} disabled={lockedOption(o)} onClick={() => { dirty(); setOptions(options.filter((_, k) => k !== i)); }}>
                <Trash2 />
              </Button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {o.values.map((v, j) => (
                <li key={v.id} className="flex items-center gap-0.5 rounded-md border border-border ps-1">
                  {o.kind === "color" ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={t("editSwatch", { label: v.label || t("valueNumbered", { n: j + 1, option: optName(o, i) }) })}>
                          <SwatchDot swatch={{ color: v.swatchColor ?? null, image: v.swatchImage ?? null }} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <SwatchField
                          value={{ color: v.swatchColor ?? null, image: v.swatchImage ?? null }}
                          onChange={(sw) => setOption(i, { values: o.values.map((x, k) => (k === j ? { ...x, swatchColor: sw.color, swatchImage: sw.image } : x)) })}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : null}
                  <Input
                    data-fk={v.id}
                    aria-label={t("valueNumbered", { n: j + 1, option: optName(o, i) })}
                    value={v.label}
                    maxLength={60}
                    dir="auto"
                    className="h-8 w-24 border-0 shadow-none"
                    onChange={(e) => setValue(i, j, e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={t("moveValueEarlier", { label: v.label || t("valueNumbered", { n: j + 1, option: optName(o, i) }) })} disabled={j === 0} onClick={() => setOption(i, { values: move(o.values, j, -1) })}>
                    <ChevronLeft className="rtl:-scale-x-100" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={t("moveValueLater", { label: v.label || t("valueNumbered", { n: j + 1, option: optName(o, i) }) })} disabled={j === o.values.length - 1} onClick={() => setOption(i, { values: move(o.values, j, 1) })}>
                    <ChevronRight className="rtl:-scale-x-100" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={t("removeValue", { label: v.label || t("valueNumbered", { n: j + 1, option: optName(o, i) }) })}
                    disabled={variants.some((x) => x.saved && x.values[o.id] === v.id)}
                    onClick={() => {
                      setVariants(variants.filter((x) => x.values[o.id] !== v.id));
                      setOption(i, { values: o.values.filter((_, k) => k !== j) });
                      setFocusKey(`add-${o.id}`);
                    }}
                  >
                    <X />
                  </Button>
                </li>
              ))}
              <li>
                <Button type="button" variant="outline" size="sm" data-fk={`add-${o.id}`} aria-label={t("addValue", { name: optName(o, i) })} onClick={() => { const id = newId(); setOption(i, { values: [...o.values, { id, label: "" }] }); setFocusKey(id); }}>
                  <Plus />
                  {t("addValueShort")}
                </Button>
              </li>
              {sizeSets?.length && o.kind !== "color" ? (
                <li>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">{t("useSizeSet")}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-1">
                      <p className="text-xs text-muted-foreground">{t("useSizeSetHint")}</p>
                      {sizeSets.map((set) => (
                        <Button
                          key={set.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() =>
                            setOption(i, {
                              values: [...o.values.filter((x) => x.label.trim()), ...mergeSizeSet(o.values.map((x) => x.label), set.items).map((label) => ({ id: newId(), label }))],
                            })
                          }
                        >
                          {set.name}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </li>
              ) : null}
            </ul>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={options.length >= 3 || unsaved} data-fk="open-option" onClick={() => startAdd("text", "", "open-option")}>
          <Plus />
          {t("addOption")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={options.length >= 3 || unsaved || options.some(isSizeOption)} data-fk="open-size" onClick={() => startAdd("text", t("sizeName"), "open-size")}>
          <Plus />
          {t("addSize")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={options.length >= 3 || unsaved || hasColor} data-fk="open-color" onClick={() => startAdd("color", t("colorName"), "open-color")}>
          <Plus />
          {t("addColor")}
        </Button>
        {options.length >= 3 ? <p className="text-xs text-muted-foreground">{t("maxOptions")}</p> : unsaved ? <p className="text-xs text-muted-foreground">{t("addOptionUnsaved")}</p> : null}
      </div>

      {options.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{options.length > 1 ? t("variantsList") : t("sizes")}</h3>
            <div className="flex flex-wrap gap-2">
              {variants.some((v) => !v.sku.trim()) ? (
                <Button type="button" variant="outline" size="sm" onClick={fillSkus}>
                  <Wand2 />
                  {t("fillSkus")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" data-fk="add-missing" onClick={addMissing}>
                <Plus />
                {t("addMissing")}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("skuHint")}</p>
          {options.length > 1 ? (
            <p className={combos > 50 ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
              <bdi dir="ltr">{comboFormula} = {combos}</bdi> {t("comboHint")}
            </p>
          ) : null}
          {!variants.length ? (
            <p className="text-sm text-muted-foreground">{t("noSizes")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("size")}</th>
                    <th>{t("sku")}</th>
                    <th className="!text-end">{t("count")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => {
                    const label = variantLabel(options, v.values);
                    return (
                      <tr key={v.id} className={v.isActive ? "" : "opacity-70"}>
                        <td>
                          <bdi className="font-medium">{label}</bdi>
                          {!v.isActive ? <Chip token="neutral" size="sm" className="ms-2">{t("inactive")}</Chip> : null}
                        </td>
                        <td>
                          <Input
                            aria-label={`${t("sku")} ${label}`}
                            value={v.sku}
                            maxLength={80}
                            dir="ltr"
                            className="h-8 max-w-40"
                            onChange={(e) => { dirty(); setVariants(variants.map((x, k) => (k === i ? { ...x, sku: e.target.value } : x))); }}
                          />
                        </td>
                        <td className="num text-end" title={t("stockHint")}>{v.stock}</td>
                        <td className="text-end">
                          {v.saved ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-fk={`dv-${v.id}`}
                              aria-label={v.isActive ? t("deactivate", { label }) : t("reactivate", { label })}
                              title={v.isActive ? t("deactivate", { label }) : t("reactivate", { label })}
                              onClick={() => { lastDeactivated.current = v.id; if (v.isActive) setConfirmDeactivate(i); else toggleActive(i); }}
                            >
                              {v.isActive ? <PowerOff /> : <Power />}
                            </Button>
                          ) : (
                            <Button type="button" variant="ghost" size="sm" aria-label={t("removeNew", { label })} title={t("removeNew", { label })} onClick={() => { dirty(); setVariants(variants.filter((_, k) => k !== i)); setFocusKey("add-missing"); }}>
                              <Trash2 />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={busy}>
          {t("save")}
        </Button>
        {unsaved && !message ? <p className="text-xs text-muted-foreground">{t("unsavedHint")}</p> : null}
        {message ? (
          <p role={result?.ok ? "status" : "alert"} className={result?.ok ? "text-sm text-success" : "rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"}>
            {message}
          </p>
        ) : null}
      </div>
      {adding ? (
        <BackfillDialog
          kind={adding.kind}
          defaultName={adding.name}
          count={variants.filter((v) => v.saved).length}
          sizeSets={sizeSets ?? []}
          onCancel={() => { setAdding(null); setFocusKey(openerRef.current); }}
          onConfirm={confirmAdd}
        />
      ) : null}
      <Dialog open={confirmDeactivate !== null} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <DialogContent
          className="max-w-sm"
          onCloseAutoFocus={(e) => {
            // controlled dialog without a Trigger: give focus back to the row's own button
            e.preventDefault();
            if (lastDeactivated.current) setFocusKey(`dv-${lastDeactivated.current}`);
          }}
        >
          <DialogTitle>
            {t("deactivate", { label: confirmDeactivate !== null && variants[confirmDeactivate] ? variantLabel(options, variants[confirmDeactivate].values) : "" })}
          </DialogTitle>
          <DialogDescription>{t("deactivateConfirmBody")}</DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (confirmDeactivate !== null) toggleActive(confirmDeactivate);
                setConfirmDeactivate(null);
              }}
            >
              {t("confirmDeactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
