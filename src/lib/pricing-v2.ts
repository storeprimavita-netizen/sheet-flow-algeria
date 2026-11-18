// Pricing calculator v2 (D50 owner formulas, D51 markup base). Pure functions:
// no DB, no UI, every setting is a parameter (D38). Internal values are
// unrounded; round only for display. Any non-finite input or zero denominator
// yields `null` (never NaN/Infinity) and nulls propagate downstream.
//
// UNITS: all percentages are FRACTIONS 0-1 (platformPct 0.01 = 1%, share 0.5,
// deadPct 0.1, confirmPct/deliveryPct 0.65, markup 0.65 = 65%). Money is DZD
// except fields ending in `Usd`.
// NAMING: the spec calls two things "k". In code `deadPct` is the dead-stock
// share and `k` is the platform real % (platformPct x parallel / official).

export type ScenarioName = "best" | "medium" | "worst";
export type Rounding =
  | "none"
  | "up100"
  | "nearest50"
  | "nearest100"
  | "charm900"
  | "charm990"
  | "charm99";

type N = number | null;

type PerScenario = Record<ScenarioName, number>;

export type PricingSettings = {
  officialRate: number;
  parallelRate: number;
  platformPct: number; // fraction of price
  platformMonthlyUsd: number;
  months: number;
  share: number; // product's share of the store, fraction
  packaging: number;
  confirmationFee: number;
  otherPerOrder: number;
  returnCost: number;
  otherStockFees: number;
  deadPct: number; // dead stock, fraction
  confirmPct: PerScenario;
  deliveryPct: PerScenario;
  adMultiplier: { best: number; worst: number };
  target: { mode: "profit" | "markup"; value: number | null }; // markup is a fraction; null = unset
  rounding: Rounding;
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | null : T[K] | null };

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  officialRate: 132,
  parallelRate: 255,
  platformPct: 0.01,
  platformMonthlyUsd: 29,
  months: 2,
  share: 0.5,
  packaging: 90,
  confirmationFee: 150,
  otherPerOrder: 10,
  returnCost: 200,
  otherStockFees: 10000,
  deadPct: 0.1,
  confirmPct: { best: 0.82, medium: 0.65, worst: 0.58 },
  deliveryPct: { best: 0.82, medium: 0.65, worst: 0.58 },
  adMultiplier: { best: 0.68, worst: 1.23 },
  target: { mode: "profit", value: 1500 },
  rounding: "up100",
};

/** Native store: no platform fee lines. */
export const NATIVE_PLATFORM_PRESET = { platformPct: 0, platformMonthlyUsd: 0 } as const;

export type PricingProduct = {
  stockCostDzd: number;
  quantity: number;
  adCostUsd: { best?: number | null; medium: number | null; worst?: number | null };
  finalPrice?: number | null;
  overrides?: DeepPartial<PricingSettings> | null;
};

export type ScenarioInput = { confirm: N; delivery: N; adCostUsd: N };

export type ScenarioResult = {
  sellable: N;
  costPiece: N;
  k: N;
  ordersNeeded: N;
  returnedOrders: N;
  adCostPerDeliveredUsd: N;
  totalAdUsd: N;
  totalAdDzd: N;
  lines: {
    product: N;
    ads: N;
    returns: N;
    confirmation: N;
    packaging: N;
    otherPerOrder: N;
    otherStock: N;
    platformMonthly: N;
  };
  totalCost: N;
  targetProfit: N;
  exactPrice: N;
  platformFee: N;
  recommendedPrice: N;
  finalPrice: N; // the P actually used
  profitPerPiece: N;
  netProfit: N;
  margin: N;
  breakEven: {
    minConfirmation: N;
    minDelivery: N;
    maxAdCostUsd: N;
    minSellingPrice: N;
  };
};

// ---------- null-safe arithmetic ----------

const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Single division helper: non-finite or zero denominator -> null. */
function div(a: N, b: N): N {
  if (!fin(a) || !fin(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}
function mul(...xs: N[]): N {
  let r = 1;
  for (const x of xs) {
    if (!fin(x)) return null;
    r *= x;
  }
  return Number.isFinite(r) ? r : null;
}
function add(...xs: N[]): N {
  let r = 0;
  for (const x of xs) {
    if (!fin(x)) return null;
    r += x;
  }
  return Number.isFinite(r) ? r : null;
}
function sub(a: N, b: N): N {
  return fin(a) && fin(b) ? a - b : null;
}
const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------- settings merge ----------

const ROUNDINGS: readonly string[] = ["none", "up100", "nearest50", "nearest100", "charm900", "charm990", "charm99"];

function mergeNode(base: unknown, over: unknown): unknown {
  if (over === null || over === undefined) return base;
  if (typeof base === "object" && base !== null) {
    if (typeof over !== "object") return base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(base as object)) {
      out[key] = mergeNode((base as Record<string, unknown>)[key], (over as Record<string, unknown>)[key]);
    }
    return out;
  }
  if (typeof base === "number") return fin(over) ? over : base;
  if (typeof base === "string") return typeof over === "string" ? over : base;
  return base;
}

/**
 * Deep merge copying only defined, type-correct, finite values. `target` is
 * merged as ONE unit (mode + value mean different things per mode): a mode
 * change without a value leaves the value null, so the price becomes null
 * instead of reading a DZD value as a markup fraction.
 */
export function mergeSettings(base: PricingSettings, overrides?: DeepPartial<PricingSettings> | null): PricingSettings {
  const { target: ot, ...rest } = (overrides ?? {}) as DeepPartial<PricingSettings>;
  const out = mergeNode({ ...base, target: undefined }, rest) as PricingSettings;
  if (!ROUNDINGS.includes(out.rounding)) out.rounding = base.rounding;
  // D52: a value counts only together with a valid mode; value alone -> empty target.
  const validMode = ot?.mode === "profit" || ot?.mode === "markup";
  if (validMode) {
    const sameMode = ot.mode === base.target.mode;
    out.target = { mode: ot.mode as "profit" | "markup", value: fin(ot.value) ? ot.value : sameMode ? base.target.value : null };
  } else {
    out.target = fin(ot?.value) ? { mode: base.target.mode, value: null } : { ...base.target };
  }
  return out;
}

// ---------- ad costs & rounding ----------

/** best/worst = round2(medium x multiplier) unless typed. */
export function resolveAdCosts(
  medium: N,
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
  typed: { best?: number | null; worst?: number | null } = {},
): Record<ScenarioName, N> {
  const derived = (m: number) => (fin(medium) && medium >= 0 && fin(m) && m >= 0 ? round2(medium * m) : null);
  return {
    best: fin(typed.best) ? typed.best : derived(settings.adMultiplier.best),
    medium: fin(medium) && medium >= 0 ? medium : null,
    worst: fin(typed.worst) ? typed.worst : derived(settings.adMultiplier.worst),
  };
}

/**
 * Round an exact price. Rounds to cents first so float noise
 * (300.00000000000006) does not jump a whole step. nearest50/100 may round
 * BELOW the exact price (and undercut target profit); charm endings (our
 * reading: next number ending 900/990/99 at or above exact) never do.
 */
export function applyRounding(exact: N, rounding: Rounding): N {
  if (!fin(exact) || exact <= 0) return null;
  const out = roundRaw(exact, rounding);
  return fin(out) && out > 0 ? out : null;
}

function roundRaw(exact: number, rounding: Rounding): N {
  const x = round2(exact);
  const charm = (step: number, ending: number) => {
    const base = Math.floor(x / step) * step + ending;
    return base >= x ? base : base + step;
  };
  switch (rounding) {
    case "none":
      return exact;
    case "up100":
      return Math.ceil(x / 100) * 100;
    case "nearest50":
      return Math.round(x / 50) * 50;
    case "nearest100":
      return Math.round(x / 100) * 100;
    case "charm900":
      return charm(1000, 900);
    case "charm990":
      return charm(1000, 990);
    case "charm99":
      return charm(100, 99);
    default:
      return null;
  }
}

// ---------- engine ----------

/** D52: markup above 1000% of product cost is treated as a typo (65 for 65%). */
export const MAX_MARKUP = 10;

const emptyBreakEven = (): ScenarioResult["breakEven"] => ({
  minConfirmation: null,
  minDelivery: null,
  maxAdCostUsd: null,
  minSellingPrice: null,
});

/**
 * One scenario at explicit confirmation / delivery / ad cost (so the PRICE-3
 * Real column reuses it). `finalPrice` > 0 is P; anything else (0, negative,
 * empty, NaN) falls back to `defaultPrice`. `defaultPrice` omitted (undefined)
 * means this scenario's own recommended price; an explicit null stays null.
 */
export function computeScenario(
  settings: PricingSettings,
  product: Pick<PricingProduct, "stockCostDzd" | "quantity">,
  s: ScenarioInput,
  finalPrice?: number | null,
  defaultPrice?: N,
): ScenarioResult {
  const O = settings.officialRate;
  const B = settings.parallelRate;
  // range checks: out-of-range settings (percent typed as 50, negatives) -> null
  const nn = (x: N) => (fin(x) && x >= 0 ? x : null);
  const frac = (x: N) => (fin(x) && x >= 0 && x < 1 ? x : null);
  const st = {
    platformPct: frac(settings.platformPct),
    share: fin(settings.share) && settings.share >= 0 && settings.share <= 1 ? settings.share : null,
    platformMonthlyUsd: nn(settings.platformMonthlyUsd),
    months: nn(settings.months),
    packaging: nn(settings.packaging),
    confirmationFee: nn(settings.confirmationFee),
    otherPerOrder: nn(settings.otherPerOrder),
    returnCost: nn(settings.returnCost),
    otherStockFees: nn(settings.otherStockFees),
    target:
      settings.target.mode === "markup"
        ? fin(settings.target.value) && settings.target.value >= 0 && settings.target.value <= MAX_MARKUP
          ? settings.target.value
          : null
        : nn(settings.target.value),
  };
  const inRange = (x: N) => (fin(x) && x > 0 && x <= 1 ? x : null);
  const c = inRange(s.confirm);
  const d = inRange(s.delivery);
  const ad = nn(s.adCostUsd);
  const ratesOk = fin(O) && O > 0 && fin(B) && B > 0;
  const deadOk = fin(settings.deadPct) && settings.deadPct >= 0 && settings.deadPct < 1;
  const sellable = ratesOk && deadOk ? mul(product.quantity, 1 - settings.deadPct) : null;
  const sellableOk = fin(sellable) && sellable > 0 ? sellable : null;

  const costPiece = div(nn(product.stockCostDzd), sellableOk);
  const k = ratesOk ? div(mul(st.platformPct, B), O) : null;
  const cd = mul(c, d);
  const ordersNeeded = div(sellableOk, cd);
  const returnedOrders = sub(div(sellableOk, d), sellableOk);
  const adCostPerDeliveredUsd = div(ad, cd);
  const totalAdUsd = mul(ordersNeeded, ad);
  const totalAdDzd = mul(totalAdUsd, B);

  const lines = {
    product: costPiece,
    ads: mul(adCostPerDeliveredUsd, B),
    returns: div(mul(st.returnCost, returnedOrders), sellableOk),
    confirmation: add(st.confirmationFee),
    packaging: add(st.packaging),
    otherPerOrder: add(st.otherPerOrder),
    otherStock: div(st.otherStockFees, sellableOk),
    platformMonthly: div(mul(st.platformMonthlyUsd, st.months, st.share, B), sellableOk),
  };
  const totalCost = add(...Object.values(lines));

  const targetProfit =
    settings.target.mode === "markup" ? mul(costPiece, st.target) : st.target;
  const oneMinusK = sub(1, k);
  const denom = fin(oneMinusK) && oneMinusK > 0 ? oneMinusK : null;
  const rawExact = div(add(totalCost, targetProfit), denom);
  const exactPrice = fin(rawExact) && rawExact > 0 ? rawExact : null;
  const platformFee = mul(exactPrice, k);
  const recommendedPrice = applyRounding(exactPrice, settings.rounding);

  const fallback = defaultPrice === undefined ? recommendedPrice : defaultPrice;
  const P = fin(finalPrice) && finalPrice > 0 ? finalPrice : fin(fallback) && fallback > 0 ? fallback : null;
  const profitPerPiece = sub(sub(P, totalCost), mul(P, k));
  const netProfit = mul(profitPerPiece, sellableOk);
  const margin = div(profitPerPiece, P);

  const NP = mul(P, denom);
  const costExAds = sub(totalCost, lines.ads);
  const costExAdsReturns = sub(costExAds, lines.returns);
  const room = sub(NP, costExAds); // price net of platform fee minus non-ad costs
  const cap = (x: N) => (fin(x) && x >= 0 && x <= 1 ? x : null);
  const positive = (x: N) => (fin(x) && x > 0 ? x : null);
  const breakEven = {
    minConfirmation: positive(room) === null ? null : cap(div(div(mul(ad, B), d), room)),
    minDelivery: (() => {
      const dn = add(sub(NP, costExAdsReturns), st.returnCost);
      return positive(dn) === null ? null : cap(div(add(div(mul(ad, B), c), st.returnCost), dn));
    })(),
    maxAdCostUsd: positive(div(mul(room, c, d), B)),
    minSellingPrice: div(totalCost, denom),
  };

  return {
    sellable: sellableOk,
    costPiece,
    k,
    ordersNeeded,
    returnedOrders,
    adCostPerDeliveredUsd,
    totalAdUsd,
    totalAdDzd,
    lines,
    totalCost,
    targetProfit,
    exactPrice,
    platformFee,
    recommendedPrice,
    finalPrice: P,
    profitPerPiece,
    netProfit,
    margin,
    breakEven: ratesOk ? breakEven : emptyBreakEven(),
  };
}

/** Best / medium / worst. Medium first; its recommended price is the default P. */
export function computeAll(
  workspace: DeepPartial<PricingSettings> | null | undefined,
  product: PricingProduct,
): Record<ScenarioName, ScenarioResult> {
  // defaults < workspace < product, so a sparse workspace jsonb cannot throw
  const settings = mergeSettings(mergeSettings(DEFAULT_PRICING_SETTINGS, workspace), product.overrides);
  const ads = resolveAdCosts(product.adCostUsd.medium, settings, product.adCostUsd);
  const input = (n: ScenarioName): ScenarioInput => ({
    confirm: settings.confirmPct[n],
    delivery: settings.deliveryPct[n],
    adCostUsd: ads[n],
  });
  const medium = computeScenario(settings, product, input("medium"), product.finalPrice);
  const dflt = medium.recommendedPrice;
  return {
    best: computeScenario(settings, product, input("best"), product.finalPrice, dflt),
    medium,
    worst: computeScenario(settings, product, input("worst"), product.finalPrice, dflt),
  };
}
