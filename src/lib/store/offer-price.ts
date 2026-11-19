/**
 * The ONE place that turns product settings into what a visitor pays. Pure, integer DZD, never NaN.
 * STORE-4 (order submit) reuses these functions; it never trusts a price sent by the browser.
 *
 * Rules
 * - uniform: every size costs `basePrice`. per_value: `basePrice` + the sum of the deltas of the size's
 *   option values. per_variant: the size's own override wins, else `basePrice`.
 * - A unit price <= 0 (or not a finite number) means the size is NOT sellable: refused, never clamped.
 * - A quantity offer is a fixed total for `qty` pieces of the same size. It is capped at `qty * unit`
 *   (never dearer than buying the pieces one by one) and hidden when it saves nothing.
 * - Mixed sizes: STORE-4 prices each piece row with its own size's unit price and applies the offer to the
 *   total only when "same size" is on; otherwise the saving is computed per selected size
 *   (`offerSaving(unitOfThatSize, offer)`) and the lowest saving is shown.
 * - Delivery is added by STORE-4 (D14, D60); nothing here knows about it.
 */

export type PricingMode = "uniform" | "per_value" | "per_variant";

export type SizePriceInput = {
  mode: PricingMode;
  basePrice: number;
  compareAt: number | null;
  /** price_delta of each option value of this size (per_value). */
  valueDeltas: number[];
  /** price_override / compare_at_override of this size (per_variant). */
  override: number | null;
  compareOverride: number | null;
};

export type OfferInput = { id: string; label: string; qty: number; total: number };

const whole = (n: number | null | undefined): number | null => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n));

/** Unit price in whole DZD, or null when the size cannot be sold. */
export function unitPrice(i: SizePriceInput): number | null {
  const base = whole(i.basePrice);
  if (base === null) return null;
  let price: number | null;
  if (i.mode === "per_value") {
    const deltas = i.valueDeltas.map(whole);
    price = deltas.some((d) => d === null) ? null : base + (deltas as number[]).reduce((a, b) => a + b, 0);
  } else if (i.mode === "per_variant") {
    price = whole(i.override) ?? base;
  } else {
    price = base;
  }
  return price !== null && price > 0 ? price : null;
}

/** The crossed-out price, only when it is really higher than what the visitor pays. */
export function comparePrice(i: SizePriceInput, price: number | null): number | null {
  if (price === null) return null;
  const raw = i.mode === "per_variant" && i.compareOverride !== null ? i.compareOverride : i.compareAt;
  const c = whole(raw);
  return c !== null && c > price ? c : null;
}

/** What the visitor pays for an offer: never more than buying the pieces one by one. */
export function offerCharge(unit: number, offer: Pick<OfferInput, "qty" | "total">): number {
  return Math.min(Math.round(offer.total), offer.qty * unit);
}

/** DZD saved by the offer for a size sold at `unit`; 0 or more. */
export function offerSaving(unit: number, offer: Pick<OfferInput, "qty" | "total">): number {
  return Math.max(0, offer.qty * unit - offerCharge(unit, offer));
}

/** Offers that really save something at `unit`, cheapest-per-piece last. Invalid offers drop out. */
export function visibleOffers(unit: number, offers: OfferInput[]): OfferInput[] {
  return offers.filter((o) => Number.isInteger(o.qty) && o.qty >= 2 && Number.isFinite(o.total) && o.total > 0 && offerSaving(unit, o) > 0);
}

/** Lowest sellable price among sizes ("starting from"), or null when none can be sold. */
export function lowestPrice(prices: (number | null)[]): number | null {
  const ok = prices.filter((p): p is number => p !== null);
  return ok.length ? Math.min(...ok) : null;
}

/**
 * Mixed sizes: `units` is the unit price of each of the offer's pieces (one entry per piece, each size's own
 * price). The visitor pays the offer total, never more than the pieces one by one. Same rule as `offerCharge`
 * when every piece costs the same.
 */
export function piecesCharge(units: number[], offer: Pick<OfferInput, "qty" | "total">): { subtotal: number; charge: number; saving: number } {
  const subtotal = units.reduce((a, b) => a + b, 0);
  if (units.length !== offer.qty) return { subtotal, charge: subtotal, saving: 0 };
  const charge = Math.min(Math.round(offer.total), subtotal);
  return { subtotal, charge, saving: subtotal - charge };
}
