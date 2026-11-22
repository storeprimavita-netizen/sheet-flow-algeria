"use client";

import * as React from "react";

import { formatCurrency } from "@/lib/format";
import type { PublicVariant } from "@/lib/store/data";
import type { FormField } from "@/lib/store/form-fields";
import { comparePrice, piecesCharge } from "@/lib/store/offer-price";

import type { OrderFormStrings } from "./order-form-strings";
import { Swatch } from "./swatch";

/** Props-only: no server imports, no data fetching, strings come in. Used in the admin preview until orders open (STORE-4). */
export type OrderFormProps = {
  /** future STORE-4 endpoint; the form posts here (method post, never GET: no phone number in a URL) */
  action: string;
  strings: OrderFormStrings;
  variants: PublicVariant[];
  /** price when the product has no sizes */
  basePrice: number | null;
  offers: { id: string; label: string; qty: number; total: number; saving: number }[];
  bump: { id: string; name: string; price: number } | null;
  fields: FormField[];
  deliveryMethods: ("home" | "stopdesk")[];
  wilayas: { code: number; name: string }[];
  pricingMode: "uniform" | "per_value" | "per_variant";
  /** safe-area sticky CTA: preview only */
  stickyCta?: boolean;
};

const fill = (tpl: string, p: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ""));
const PHONE = /^0[567]\d{8}$/;

type Errors = Record<string, string>;
type Piece = { colorKey?: number; variantId?: string };
type ColorGroup = NonNullable<PublicVariant["color"]> & { variants: PublicVariant[]; inStock: boolean };
const emptyPiece: Piece = {};

function groupColors(variants: PublicVariant[]): ColorGroup[] {
  const groups = new Map<number, ColorGroup>();
  for (const variant of variants) {
    if (!variant.color) return []; // Legacy or incomplete configurations still expose exact variants.
    const { key } = variant.color;
    let group = groups.get(key);
    if (!group) {
      group = { ...variant.color, variants: [], inStock: false };
      groups.set(key, group);
    }
    group.variants.push(variant);
    group.inStock ||= variant.inStock;
  }
  return [...groups.values()].sort((a, b) => a.key - b.key);
}

export function OrderForm({ action, strings: s, variants, basePrice, offers, bump, fields, deliveryMethods, wilayas, pricingMode, stickyCta }: OrderFormProps) {
  const unitLabel = s.currency;
  const sized = variants.length > 0;
  const colors = groupColors(variants);
  const hasColors = colors.length > 0;
  const colorOnly = hasColors && colors.every((c) => c.variants.length === 1 && c.remainingLabel === null);
  const [offerId, setOfferId] = React.useState<string>("single");
  const offer = offers.find((o) => o.id === offerId) ?? null;
  const qty = offer?.qty ?? 1;
  const [pieces, setPieces] = React.useState<Piece[]>(() => {
    const only = variants.length === 1 && variants[0].inStock ? variants[0] : undefined;
    return [only ? { colorKey: only.color?.key, variantId: only.id } : emptyPiece];
  });
  const [same, setSame] = React.useState(true);
  const [withBump, setWithBump] = React.useState(false);
  const [delivery, setDelivery] = React.useState<string | null>(deliveryMethods.length === 1 ? deliveryMethods[0] : null);
  const [errors, setErrors] = React.useState<Errors>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  const piecesFor = (n: number, prev: Piece[]) => Array.from({ length: n }, (_, i) => prev[i] ?? (same ? prev[0] ?? emptyPiece : emptyPiece));
  const rows = piecesFor(qty, pieces);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const chosen = rows.map(({ variantId, colorKey }) => {
    const variant = byId.get(variantId ?? "");
    return variant?.inStock && (!hasColors || variant.color?.key === colorKey) ? variant : undefined;
  });
  const units = chosen.map((variant) => sized ? variant?.price ?? null : basePrice);
  const allChosen = units.every((u) => u !== null);

  function chooseOffer(id: string) {
    setOfferId(id);
    const o = offers.find((x) => x.id === id);
    setPieces((prev) => piecesFor(o?.qty ?? 1, prev));
    clearPieceErrors();
  }
  function clearPieceErrors(index?: number) {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) =>
      index === undefined ? !/^(color|variant)_\d+$/.test(name) : name !== `color_${index}` && name !== `variant_${index}`
    )));
  }
  function setPiece(i: number, piece: Piece) {
    setPieces((prev) => {
      const base = piecesFor(qty, prev);
      return same ? base.map(() => piece) : base.map((v, j) => (j === i ? piece : v));
    });
    clearPieceErrors(same ? undefined : i);
  }

  const priced = allChosen ? (units as number[]) : null;
  const money = priced ? (offer ? piecesCharge(priced, offer) : { subtotal: priced[0], charge: priced[0], saving: 0 }) : null;
  const bumpPrice = withBump && bump ? bump.price : 0;
  const lowest = sized ? Math.min(...variants.map((v) => v.price)) : basePrice;
  const minTotal = lowest === null ? null : offer ? Math.min(offer.total, offer.qty * lowest) : lowest;

  const first = chosen[0];
  const compare = !offer && first ? comparePrice({ mode: pricingMode, basePrice: first.price, compareAt: first.compareAt, valueDeltas: [], override: null, compareOverride: null }, first.price) : null;

  function validate(form: HTMLFormElement): Errors {
    const e: Errors = {};
    if (sized) {
      rows.forEach((piece, i) => {
        if (chosen[i]) return;
        if (hasColors && !colors.some((color) => color.key === piece.colorKey && color.inStock)) e[`color_${i}`] = s.errors.color;
        else e[`variant_${i}`] = hasColors ? s.errors.combination : s.errors.size;
      });
    }
    const data = new FormData(form);
    for (const f of fields) {
      const name = f.type === "core" ? f.key : `custom_${f.key}`;
      if (f.key === "delivery") {
        if (!delivery) e.delivery = s.errors.delivery;
        continue;
      }
      const v = String(data.get(name) ?? "").trim();
      if (f.required && !v) e[name] = s.errors.required;
      else if (f.key === "phone" && v && !PHONE.test(v.replace(/[\s.-]/g, ""))) e[name] = s.errors.phone;
      else if (f.key === "email" && v && !/^\S+@\S+\.\S+$/.test(v)) e[name] = s.errors.email;
    }
    return e;
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault(); // inert until orders open (STORE-4): nothing leaves the page
    const e = validate(ev.currentTarget);
    setErrors(e);
    const firstBad = Object.keys(e)[0];
    if (firstBad) {
      const field = ev.currentTarget.querySelector<HTMLElement>(`[data-field="${firstBad}"]:not(:disabled)`)
        ?? ev.currentTarget.querySelector<HTMLElement>(`[data-choice-group="${firstBad}"]`);
      field?.focus();
    }
  }
  function onBlur(ev: React.FocusEvent<HTMLFormElement>) {
    const el = ev.target as unknown as HTMLInputElement;
    if (!el.name || /^(color|variant)_\d+$/.test(el.name) || !formRef.current) return;
    const e = validate(formRef.current);
    setErrors((cur) => {
      const next = { ...cur };
      if (e[el.name]) next[el.name] = e[el.name];
      else delete next[el.name];
      return next;
    });
  }

  const err = (name: string) => errors[name];
  const common = (name: string) => ({ name, "data-field": name, "aria-invalid": err(name) ? true : undefined, "aria-describedby": err(name) ? `${name}-err` : undefined });
  const Err = ({ name }: { name: string }) => (err(name) ? <p className="store-field-err" id={`${name}-err`}>{err(name)}</p> : null);
  const optionPrice = (v: PublicVariant) => {
    if (pricingMode === "per_value" && v.price !== lowest) {
      return <span className="store-size-delta ltr">+{formatCurrency(v.price - (lowest ?? 0), unitLabel)}</span>;
    }
    if (hasColors && pricingMode === "per_variant") {
      return <span className="store-size-delta ltr">{formatCurrency(v.price, unitLabel)}</span>;
    }
    return null;
  };

  return (
    <form ref={formRef} className="store-form" method="post" action={action} noValidate onSubmit={onSubmit} onBlur={onBlur} aria-labelledby="order-title">
      <h2 id="order-title" className="store-form-title">{s.title}</h2>
      <p className="store-form-lead">{s.lead}</p>

      {sized ? (
        <div className="store-piece">
          {rows.map((piece, i) => {
            const colorName = `color_${i}`;
            const variantName = `variant_${i}`;
            const selectedColor = colors.find((color) => color.key === piece.colorKey && color.inStock);
            const candidates = hasColors ? selectedColor?.variants ?? [] : variants;
            return (
              <fieldset key={i} className="store-fieldset">
                {qty > 1 ? <legend className="store-label">{fill(s.piece, { n: i + 1 })}</legend> : <legend className="store-sr">{fill(s.piece, { n: 1 })}</legend>}
                {hasColors ? (
                  <fieldset className="store-fieldset" data-choice-group={colorName} tabIndex={-1}>
                    <legend className="store-label">{s.colorLabel}</legend>
                    <div className="store-sizes">
                      {colors.map((color) => (
                        <label key={color.key} className="store-size-pick store-color-pick">
                          <input
                            type="radio"
                            {...common(colorName)}
                            value={color.key}
                            checked={selectedColor?.key === color.key}
                            disabled={!color.inStock}
                            required={color.inStock}
                            onChange={() => setPiece(i, { colorKey: color.key, variantId: colorOnly ? color.variants[0].id : undefined })}
                          />
                          <span className="store-size" data-out={!color.inStock}>
                            <Swatch swatch={color.swatch} />
                            <bdi>{color.label}</bdi>
                            {colorOnly ? optionPrice(color.variants[0]) : null}
                            {color.inStock ? null : <span className="store-unavailable">{s.outOfStock}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Err name={colorName} />
                  </fieldset>
                ) : null}
                {colorOnly && chosen[i] ? <input type="hidden" name={variantName} value={chosen[i]?.id} /> : null}
                {!colorOnly && candidates.length ? (
                  <fieldset className="store-fieldset" data-choice-group={variantName} tabIndex={-1}>
                    <legend className="store-label">{hasColors ? s.combinationLabel : s.sizeLabel}</legend>
                    <div className="store-sizes">
                      {candidates.map((v) => (
                        <label key={v.id} className="store-size-pick">
                          <input type="radio" {...common(variantName)} value={v.id} checked={chosen[i]?.id === v.id} disabled={!v.inStock} required={v.inStock} onChange={() => setPiece(i, { colorKey: piece.colorKey, variantId: v.id })} />
                          <span className="store-size" data-out={!v.inStock}>
                            <bdi>{hasColors ? v.color?.remainingLabel ?? v.label : v.label}</bdi>
                            {optionPrice(v)}
                            {v.inStock ? null : <span className={hasColors ? "store-unavailable" : "store-sr"}>{s.outOfStock}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Err name={variantName} />
                  </fieldset>
                ) : null}
                {i === 0 && qty > 1 ? (
                  <label className="store-check">
                    <input type="checkbox" checked={same} onChange={(e) => {
                      setSame(e.target.checked);
                      if (e.target.checked) {
                        setPieces(rows.map(() => piece));
                        clearPieceErrors();
                      }
                    }} />
                    {hasColors ? s.sameOptions : s.sameSize}
                  </label>
                ) : null}
              </fieldset>
            );
          })}
          {!allChosen && lowest !== null && pricingMode === "per_variant" ? <p className="store-hint">{fill(s.startingFrom, { price: formatCurrency(lowest, unitLabel) })}</p> : null}
        </div>
      ) : null}

      {offers.length > 0 ? (
        <fieldset className="store-fieldset">
          <legend className="store-label">{s.offersTitle}</legend>
          <label className="store-offer">
            <input type="radio" name="offer" value="" checked={offerId === "single"} onChange={() => chooseOffer("single")} />
            <span>{s.single}</span>
          </label>
          {offers.map((o) => (
            <label key={o.id} className="store-offer">
              <input type="radio" name="offer" value={o.id} checked={offerId === o.id} onChange={() => chooseOffer(o.id)} />
              <span>
                {o.label}
                <span className="store-offer-save"> {fill(s.offerSave, { n: formatCurrency(o.saving, unitLabel) })}</span>
              </span>
              <span className="store-price ltr">{formatCurrency(o.total, unitLabel)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="store-fields">
        {fields.map((f) => {
          const name = f.type === "core" ? f.key : `custom_${f.key}`;
          const label = f.label ?? (f.type === "core" ? s.fields[f.key] : f.key);
          const req = f.required;
          const lab = (
            <span className="store-label">{label}{req ? null : <span className="store-optional"> ({s.fields.optional})</span>}</span>
          );
          if (f.key === "delivery" && f.type === "core") {
            return (
              <fieldset key={f.key} className="store-fieldset" aria-describedby={err("delivery") ? "delivery-err" : undefined}>
                <legend className="store-label">{label}</legend>
                <div className="store-methods">
                  {deliveryMethods.map((m) => (
                    <label key={m} className="store-offer">
                      <input type="radio" name="delivery" value={m} checked={delivery === m} data-field={m === deliveryMethods[0] ? "delivery" : undefined} onChange={() => { setDelivery(m); setErrors((c) => { const n = { ...c }; delete n.delivery; return n; }); }} />
                      <span>{m === "home" ? s.fields.home : s.fields.stopdesk}</span>
                    </label>
                  ))}
                </div>
                <Err name="delivery" />
              </fieldset>
            );
          }
          if (f.key === "wilaya" && f.type === "core") {
            return (
              <label key={f.key} className="store-field">
                {lab}
                <select className="store-input" {...common(name)} required defaultValue="" autoComplete="address-level1">
                  <option value="" disabled>{s.fields.chooseWilaya}</option>
                  {wilayas.map((w) => <option key={w.code} value={w.code}>{`${w.code} - ${w.name}`}</option>)}
                </select>
                <Err name={name} />
              </label>
            );
          }
          if (f.type === "select") {
            return (
              <label key={f.key} className="store-field">
                {lab}
                <select className="store-input" {...common(name)} defaultValue="">
                  <option value="" disabled={req}>{s.fields.choose}</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <Err name={name} />
              </label>
            );
          }
          if (f.key === "note") {
            return (
              <label key={f.key} className="store-field">
                {lab}
                <textarea className="store-input" rows={3} maxLength={500} {...common(name)} />
                <Err name={name} />
              </label>
            );
          }
          const attrs =
            f.key === "name" ? { type: "text", autoComplete: "name" }
            : f.key === "phone" ? { type: "tel", inputMode: "tel" as const, autoComplete: "tel", dir: "ltr", maxLength: 14 }
            : f.key === "email" ? { type: "email", autoComplete: "email", dir: "ltr" }
            : f.key === "commune" ? { type: "text", autoComplete: "address-level2" }
            : { type: "text", maxLength: 200 };
          return (
            <label key={f.key} className="store-field">
              {lab}
              <input className="store-input" {...attrs} {...common(name)} />
              <Err name={name} />
            </label>
          );
        })}
      </div>

      {bump ? (
        <label className="store-offer">
          <input type="checkbox" name="bump" value={bump.id} checked={withBump} onChange={(e) => setWithBump(e.target.checked)} />
          <span>{fill(s.bumpAdd, { name: bump.name })}</span>
          <span className="store-price ltr">{formatCurrency(bump.price, unitLabel)}</span>
        </label>
      ) : null}

      <dl className="store-summary" aria-live="polite">
        {money ? (
          <>
            <div><dt>{s.summary.product}</dt><dd className="ltr">{formatCurrency(money.subtotal, unitLabel)}</dd></div>
            {money.saving > 0 ? <div><dt>{s.summary.saving}</dt><dd className="ltr store-saving">{`−${formatCurrency(money.saving, unitLabel)}`}</dd></div> : null}
            {bumpPrice > 0 ? <div><dt>{bump?.name}</dt><dd className="ltr">{formatCurrency(bumpPrice, unitLabel)}</dd></div> : null}
            <div className="store-total"><dt>{s.summary.total}</dt><dd className="ltr">{formatCurrency(money.charge + bumpPrice, unitLabel)}</dd></div>
          </>
        ) : minTotal !== null ? (
          <div className="store-total"><dt>{s.summary.total}</dt><dd className="ltr">{fill(s.startingFrom, { price: formatCurrency(minTotal, unitLabel) })}</dd></div>
        ) : null}
      </dl>
      {compare !== null && money ? <p className="store-hint"><s className="ltr">{formatCurrency(compare, unitLabel)}</s></p> : null}
      <p className="store-hint">{s.summary.deliveryNote}</p>

      <div className="store-cta" data-sticky={stickyCta ? "true" : undefined}>
        <button type="submit" className="store-btn store-btn-block">{s.submit}</button>
        <p className="store-hint">{s.cod}</p>
      </div>
    </form>
  );
}
