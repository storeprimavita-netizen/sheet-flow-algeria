"use client";

import * as React from "react";

import { formatCurrency } from "@/lib/format";
import type { FormField } from "@/lib/store/form-fields";
import { comparePrice, piecesCharge } from "@/lib/store/offer-price";

import type { OrderFormStrings } from "./order-form-strings";

/** Props-only: no server imports, no data fetching, strings come in. Used in the admin preview until orders open (STORE-4). */
export type OrderFormProps = {
  /** future STORE-4 endpoint; the form posts here (method post, never GET: no phone number in a URL) */
  action: string;
  strings: OrderFormStrings;
  variants: { id: string; label: string; inStock: boolean; price: number; compareAt: number | null }[];
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

export function OrderForm({ action, strings: s, variants, basePrice, offers, bump, fields, deliveryMethods, wilayas, pricingMode, stickyCta }: OrderFormProps) {
  const unitLabel = s.currency;
  const sized = variants.length > 0;
  const [offerId, setOfferId] = React.useState<string>("single");
  const offer = offers.find((o) => o.id === offerId) ?? null;
  const qty = offer?.qty ?? 1;
  // nothing is preselected when there is more than one size
  const [pieces, setPieces] = React.useState<(string | null)[]>(() => [variants.length === 1 && variants[0].inStock ? variants[0].id : null]);
  const [same, setSame] = React.useState(true);
  const [withBump, setWithBump] = React.useState(false);
  const [delivery, setDelivery] = React.useState<string | null>(deliveryMethods.length === 1 ? deliveryMethods[0] : null);
  const [errors, setErrors] = React.useState<Errors>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  const piecesFor = (n: number, prev: (string | null)[]) => Array.from({ length: n }, (_, i) => prev[i] ?? (same ? prev[0] ?? null : null));
  const rows = piecesFor(qty, pieces);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const unitOf = (id: string | null) => (sized ? (id ? (byId.get(id)?.price ?? null) : null) : basePrice);
  const units = rows.map(unitOf);
  const allChosen = units.every((u) => u !== null);

  function chooseOffer(id: string) {
    setOfferId(id);
    const o = offers.find((x) => x.id === id);
    setPieces((prev) => piecesFor(o?.qty ?? 1, prev));
  }
  function setPiece(i: number, id: string) {
    setPieces((prev) => {
      const base = piecesFor(qty, prev);
      return same ? base.map(() => id) : base.map((v, j) => (j === i ? id : v));
    });
  }

  const priced = allChosen ? (units as number[]) : null;
  const money = priced ? (offer ? piecesCharge(priced, offer) : { subtotal: priced[0], charge: priced[0], saving: 0 }) : null;
  const bumpPrice = withBump && bump ? bump.price : 0;
  const lowest = sized ? Math.min(...variants.map((v) => v.price)) : basePrice;
  const minTotal = lowest === null ? null : offer ? Math.min(offer.total, offer.qty * lowest) : lowest;

  const first = rows[0] ? byId.get(rows[0]) : undefined;
  const compare = !offer && first ? comparePrice({ mode: pricingMode, basePrice: first.price, compareAt: first.compareAt, valueDeltas: [], override: null, compareOverride: null }, first.price) : null;

  function validate(form: HTMLFormElement): Errors {
    const e: Errors = {};
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
    if (sized && rows.some((r) => !r)) e.size = s.errors.size;
    return e;
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault(); // inert until orders open (STORE-4): nothing leaves the page
    const e = validate(ev.currentTarget);
    setErrors(e);
    const firstBad = Object.keys(e)[0];
    if (firstBad) formRef.current?.querySelector<HTMLElement>(`[data-field="${firstBad}"]`)?.focus();
  }
  function onBlur(ev: React.FocusEvent<HTMLFormElement>) {
    const el = ev.target as unknown as HTMLInputElement;
    if (!el.name || !formRef.current) return;
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

  return (
    <form ref={formRef} className="store-form" method="post" action={action} noValidate onSubmit={onSubmit} onBlur={onBlur} aria-labelledby="order-title">
      <h2 id="order-title" className="store-form-title">{s.title}</h2>
      <p className="store-form-lead">{s.lead}</p>

      {sized ? (
        <fieldset className="store-fieldset">
          <legend className="store-label">{s.sizeLabel}</legend>
          {rows.map((r, i) => (
            <div key={i} className="store-piece">
              {qty > 1 ? <span className="store-label">{fill(s.piece, { n: i + 1 })}</span> : null}
              <div className="store-sizes" role="radiogroup" aria-label={s.sizeLabel}>
                {variants.map((v) => (
                  <label key={v.id} className="store-size-pick" data-out={!v.inStock}>
                    <input type="radio" name={`variant_${i}`} value={v.id} checked={r === v.id} disabled={!v.inStock} data-field={i === 0 ? "size" : undefined} onChange={() => setPiece(i, v.id)} />
                    <span className="store-size" data-out={!v.inStock}>
                      <bdi>{v.label}</bdi>
                      {pricingMode === "per_value" && v.price !== lowest ? <span className="store-size-delta ltr">+{formatCurrency(v.price - (lowest ?? 0), unitLabel)}</span> : null}
                      {v.inStock ? null : <span className="store-sr">{s.outOfStock}</span>}
                    </span>
                  </label>
                ))}
              </div>
              {i === 0 && qty > 1 ? (
                <label className="store-check">
                  <input type="checkbox" checked={same} onChange={(e) => { setSame(e.target.checked); if (e.target.checked) setPieces(rows.map(() => rows[0])); }} />
                  {s.sameSize}
                </label>
              ) : null}
            </div>
          ))}
          <Err name="size" />
          {sized && !allChosen && lowest !== null && pricingMode === "per_variant" ? <p className="store-hint">{fill(s.startingFrom, { price: formatCurrency(lowest, unitLabel) })}</p> : null}
        </fieldset>
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
