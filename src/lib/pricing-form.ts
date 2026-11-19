// Pure form <-> settings glue for the pricing calculator (PRICE-2). NO pricing
// formulas live here (those are pricing-v2.ts only): this file converts between
// what the owner types (percent) and what the engine stores (fractions), checks
// ranges, and turns a form into a sparse override object.
//
// UNITS: forms hold DISPLAY units (percent as 65, markup as 65 meaning 65%);
// settings / overrides / the DB hold FRACTIONS (0.65). Ranges below are in
// STORED units so the same table validates DB rows and form input.
import { z } from "zod";

import {
  MAX_MARKUP,
  type DeepPartial,
  type PricingSettings,
  type Rounding,
  type ScenarioInput,
  type ScenarioResult,
} from "./pricing-v2";

export const ROUNDING_OPTIONS = ["none", "up100", "nearest50", "nearest100", "charm900", "charm990", "charm99"] as const satisfies readonly Rounding[];

export type FieldKey =
  | "officialRate"
  | "parallelRate"
  | "platformPct"
  | "platformMonthlyUsd"
  | "months"
  | "share"
  | "packaging"
  | "confirmationFee"
  | "otherPerOrder"
  | "returnCost"
  | "otherStockFees"
  | "deadPct"
  | "confirmPct.best"
  | "confirmPct.medium"
  | "confirmPct.worst"
  | "deliveryPct.best"
  | "deliveryPct.medium"
  | "deliveryPct.worst"
  | "adMultiplier.best"
  | "adMultiplier.worst";

export type FieldGroup = "rates" | "platform" | "store" | "perOrder" | "stock" | "funnel" | "ads";

export type FieldDef = {
  key: FieldKey;
  group: FieldGroup;
  /** stored as a fraction, typed as a percent */
  pct: boolean;
  /** stored-unit range */
  min: number;
  minExcl?: boolean;
  max?: number;
  maxExcl?: boolean;
};

const pctOpen = { pct: true, min: 0, minExcl: true, max: 1 } as const; // (0, 100]
const pctUpper = { pct: true, min: 0, max: 1, maxExcl: true } as const; // [0, 100)

export const PRICING_FIELDS: readonly FieldDef[] = [
  { key: "officialRate", group: "rates", pct: false, min: 0, minExcl: true },
  { key: "parallelRate", group: "rates", pct: false, min: 0, minExcl: true },
  { key: "platformPct", group: "platform", ...pctUpper },
  { key: "platformMonthlyUsd", group: "platform", pct: false, min: 0 },
  { key: "months", group: "platform", pct: false, min: 0 },
  { key: "share", group: "platform", pct: true, min: 0, max: 1 }, // [0, 100]
  { key: "packaging", group: "perOrder", pct: false, min: 0 },
  { key: "confirmationFee", group: "perOrder", pct: false, min: 0 },
  { key: "otherPerOrder", group: "perOrder", pct: false, min: 0 },
  { key: "returnCost", group: "perOrder", pct: false, min: 0 },
  { key: "otherStockFees", group: "stock", pct: false, min: 0 },
  { key: "deadPct", group: "stock", ...pctUpper },
  { key: "confirmPct.best", group: "funnel", ...pctOpen },
  { key: "confirmPct.medium", group: "funnel", ...pctOpen },
  { key: "confirmPct.worst", group: "funnel", ...pctOpen },
  { key: "deliveryPct.best", group: "funnel", ...pctOpen },
  { key: "deliveryPct.medium", group: "funnel", ...pctOpen },
  { key: "deliveryPct.worst", group: "funnel", ...pctOpen },
  { key: "adMultiplier.best", group: "ads", pct: false, min: 0 },
  { key: "adMultiplier.worst", group: "ads", pct: false, min: 0 },
];

const FIELD_BY_KEY = new Map(PRICING_FIELDS.map((f) => [f.key, f]));

/** stored-unit range check (finite, bounds with inclusive/exclusive ends) */
export function inRange(def: Pick<FieldDef, "min" | "minExcl" | "max" | "maxExcl">, v: unknown): v is number {
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  if (def.minExcl ? v <= def.min : v < def.min) return false;
  if (def.max !== undefined && (def.maxExcl ? v >= def.max : v > def.max)) return false;
  return true;
}

const TARGET_RANGE = {
  profit: { min: 0 },
  markup: { min: 0, max: MAX_MARKUP },
} as const;

export const targetValueValid = (mode: "profit" | "markup", v: unknown): v is number => inRange(TARGET_RANGE[mode], v);

// ---------- path helpers ----------

type Bag = Record<string, unknown>;

function getAt(o: unknown, key: FieldKey): unknown {
  const [a, b] = key.split(".");
  const top = (o as Bag | null | undefined)?.[a];
  return b === undefined ? top : (top as Bag | null | undefined)?.[b];
}

function setAt(o: Bag, key: FieldKey, v: number) {
  const [a, b] = key.split(".");
  if (b === undefined) o[a] = v;
  else o[a] = { ...((o[a] as Bag | undefined) ?? {}), [b]: v };
}

// ---------- percent <-> fraction ----------

/** fraction -> percent for display, without float noise (0.07 -> 7, not 7.000000000000001) */
export const toPercent = (fraction: number) => Math.round(fraction * 100 * 1e6) / 1e6;
/** percent typed -> fraction stored */
export const toFraction = (percent: number) => Math.round(percent * 1e6) / 1e8;

const toDisplay = (def: Pick<FieldDef, "pct">, stored: number) => (def.pct ? toPercent(stored) : stored);
const toStored = (def: Pick<FieldDef, "pct">, shown: number) => (def.pct ? toFraction(shown) : shown);

// ---------- form model ----------

export type FormValues = Record<FieldKey, number | null>;
export type TargetMode = "profit" | "markup";

/** Everything the owner edits. `null` = empty (settings: invalid; overrides: inherit). */
export type PricingForm = {
  values: FormValues;
  targetMode: TargetMode;
  /** profit: DZD per piece. markup: percent of product cost (65 = 65%). */
  targetValue: number | null;
  rounding: Rounding | null;
};

export const emptyValues = (): FormValues =>
  Object.fromEntries(PRICING_FIELDS.map((f) => [f.key, null])) as FormValues;

export const targetToDisplay = (mode: TargetMode, stored: number) => (mode === "markup" ? toPercent(stored) : stored);
const targetToStored = (mode: TargetMode, shown: number) => (mode === "markup" ? toFraction(shown) : shown);

/** Full settings -> form (workspace settings editor). */
export function formFromSettings(s: PricingSettings): PricingForm {
  const values = emptyValues();
  for (const f of PRICING_FIELDS) {
    const v = getAt(s, f.key);
    if (typeof v === "number") values[f.key] = toDisplay(f, v);
  }
  return {
    values,
    targetMode: s.target.mode,
    targetValue: s.target.value === null ? null : targetToDisplay(s.target.mode, s.target.value),
    rounding: s.rounding,
  };
}

/** Sparse overrides -> form (product editor). Missing = null = inherit. */
export function formFromOverrides(o: DeepPartial<PricingSettings>, defaults: PricingSettings): PricingForm {
  const values = emptyValues();
  for (const f of PRICING_FIELDS) {
    const v = getAt(o, f.key);
    if (inRange(f, v)) values[f.key] = toDisplay(f, v);
  }
  const t = o.target;
  const mode = t?.mode === "profit" || t?.mode === "markup" ? t.mode : null;
  return {
    values,
    targetMode: mode ?? defaults.target.mode,
    targetValue: mode && targetValueValid(mode, t?.value) ? targetToDisplay(mode, t!.value as number) : null,
    rounding: ROUNDING_OPTIONS.includes(o.rounding as Rounding) ? (o.rounding as Rounding) : null,
  };
}

export type FormErrors = Partial<Record<FieldKey | "target", "required" | "range">>;

/**
 * Per-field problems. `requireAll` (workspace settings): empty is an error.
 * Otherwise (product overrides): empty = inherit, only typed values are checked;
 * a target mode different from `defaultMode` needs a value.
 */
export function formErrors(form: PricingForm, requireAll: boolean, defaultMode?: TargetMode): FormErrors {
  const errors: FormErrors = {};
  for (const f of PRICING_FIELDS) {
    const v = form.values[f.key];
    if (v === null) {
      if (requireAll) errors[f.key] = "required";
    } else if (!inRange(f, toStored(f, v))) errors[f.key] = "range";
  }
  if (form.targetValue === null) {
    if (requireAll) errors.target = "required";
  } else if (!targetValueValid(form.targetMode, targetToStored(form.targetMode, form.targetValue))) errors.target = "range";
  if (requireAll && form.rounding === null) errors.target ??= "required";
  if (!requireAll && form.targetValue === null && defaultMode !== undefined && form.targetMode !== defaultMode) errors.target = "required";
  return errors;
}

/** Valid, fully filled settings form -> engine settings (fractions). */
export function settingsFromForm(form: PricingForm): PricingSettings {
  const out: Bag = {};
  for (const f of PRICING_FIELDS) setAt(out, f.key, toStored(f, form.values[f.key] ?? 0));
  const value = form.targetValue === null ? null : targetToStored(form.targetMode, form.targetValue);
  return { ...out, target: { mode: form.targetMode, value }, rounding: form.rounding ?? "up100" } as PricingSettings;
}

/**
 * Product form -> sparse overrides vs the current workspace defaults.
 * Empty fields inherit; every typed value is stored as an override even when it
 * equals the current default (it is pinned until the field's reset empties it).
 * `target` is ONE unit (D52): stored as {mode, value} whenever the mode differs
 * from the default or a value is typed, never value alone.
 */
export function overridesFromForm(form: PricingForm, defaults: PricingSettings): DeepPartial<PricingSettings> {
  const out: Bag = {};
  for (const f of PRICING_FIELDS) {
    const shown = form.values[f.key];
    if (shown === null) continue;
    setAt(out, f.key, toStored(f, shown));
  }
  const value = form.targetValue === null ? null : targetToStored(form.targetMode, form.targetValue);
  const modeDiffers = form.targetMode !== defaults.target.mode;
  if (modeDiffers || value !== null) {
    out.target = { mode: form.targetMode, value };
  }
  if (form.rounding !== null) out.rounding = form.rounding;
  return out as DeepPartial<PricingSettings>;
}

/** number of overridden fields (target and rounding count as one each) */
export function countOverrides(o: DeepPartial<PricingSettings>): number {
  let n = PRICING_FIELDS.filter((f) => getAt(o, f.key) !== undefined).length;
  if (o.target) n++;
  if (o.rounding) n++;
  return n;
}

// ---------- strict zod (save boundary) ----------

const field = (key: FieldKey) => {
  const def = FIELD_BY_KEY.get(key)!;
  return z.number().refine((v) => inRange(def, v), { message: `${key} out of range` });
};

const group = <K extends string>(keys: readonly K[], prefix: string, optional: boolean) =>
  z.object(
    Object.fromEntries(
      keys.map((k) => {
        const s = field(`${prefix}.${k}` as FieldKey);
        return [k, optional ? s.optional() : s];
      }),
    ) as unknown as Record<K, z.ZodType<number>>,
  );

const SCEN = ["best", "medium", "worst"] as const;

const roundingSchema = z.enum(ROUNDING_OPTIONS);

/** Strict, full workspace settings (save). */
export const pricingSettingsSchema = z.object({
  officialRate: field("officialRate"),
  parallelRate: field("parallelRate"),
  platformPct: field("platformPct"),
  platformMonthlyUsd: field("platformMonthlyUsd"),
  months: field("months"),
  share: field("share"),
  packaging: field("packaging"),
  confirmationFee: field("confirmationFee"),
  otherPerOrder: field("otherPerOrder"),
  returnCost: field("returnCost"),
  otherStockFees: field("otherStockFees"),
  deadPct: field("deadPct"),
  confirmPct: group(SCEN, "confirmPct", false),
  deliveryPct: group(SCEN, "deliveryPct", false),
  adMultiplier: group(["best", "worst"], "adMultiplier", false),
  // value may be null in the type (engine: "unset"); the settings editor never submits null (formErrors requireAll)
  target: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("profit"), value: z.number().refine((v) => targetValueValid("profit", v)).nullable() }),
    z.object({ mode: z.literal("markup"), value: z.number().refine((v) => targetValueValid("markup", v)).nullable() }),
  ]),
  rounding: roundingSchema,
});

/** Strict sparse overrides (product save). `target` carries mode + value together. */
export const pricingOverridesSchema = z
  .object({
    officialRate: field("officialRate").optional(),
    parallelRate: field("parallelRate").optional(),
    platformPct: field("platformPct").optional(),
    platformMonthlyUsd: field("platformMonthlyUsd").optional(),
    months: field("months").optional(),
    share: field("share").optional(),
    packaging: field("packaging").optional(),
    confirmationFee: field("confirmationFee").optional(),
    otherPerOrder: field("otherPerOrder").optional(),
    returnCost: field("returnCost").optional(),
    otherStockFees: field("otherStockFees").optional(),
    deadPct: field("deadPct").optional(),
    confirmPct: group(SCEN, "confirmPct", true).optional(),
    deliveryPct: group(SCEN, "deliveryPct", true).optional(),
    adMultiplier: group(["best", "worst"], "adMultiplier", true).optional(),
    target: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("profit"), value: z.number().refine((v) => targetValueValid("profit", v)) }),
        z.object({ mode: z.literal("markup"), value: z.number().refine((v) => targetValueValid("markup", v)) }),
      ])
      .optional(),
    rounding: roundingSchema.optional(),
  })
  .strict();

/** numeric(10,2) / numeric(12,2) column limits */
export const MAX_AD_USD = 99_999_999.99;
export const MAX_FINAL_PRICE = 9_999_999_999.99;

/** Input of `saveProductPricing` (zod at the server-action boundary). */
export const productPricingInputSchema = z.object({
  productId: z.uuid(),
  overrides: pricingOverridesSchema,
  adBestUsd: z.number().min(0).max(MAX_AD_USD).multipleOf(0.01).nullable(),
  adMediumUsd: z.number().min(0).max(MAX_AD_USD).multipleOf(0.01).nullable(),
  adWorstUsd: z.number().min(0).max(MAX_AD_USD).multipleOf(0.01).nullable(),
  finalPrice: z.number().gt(0).max(MAX_FINAL_PRICE).multipleOf(0.01).nullable(),
});

// ---------- lenient read (DB -> engine) ----------

/**
 * Keep only valid keys of a stored jsonb so one bad/old key never resets the
 * rest. Used for workspace `pricing_defaults` and per-product `overrides`.
 */
export function sanitizeSparse(raw: unknown): DeepPartial<PricingSettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Bag = {};
  for (const f of PRICING_FIELDS) {
    const v = getAt(raw, f.key);
    if (inRange(f, v)) setAt(out, f.key, v);
  }
  const r = raw as Bag;
  const t = r.target as Bag | null | undefined;
  if (t && typeof t === "object" && (t.mode === "profit" || t.mode === "markup")) {
    out.target = { mode: t.mode, value: targetValueValid(t.mode, t.value) ? t.value : null };
  }
  if (ROUNDING_OPTIONS.includes(r.rounding as Rounding)) out.rounding = r.rounding;
  return out as DeepPartial<PricingSettings>;
}

// ---------- stock cost ----------

/**
 * `product_costs.sourcing_cost_dzd` is PER PIECE; the engine wants the TOTAL
 * stock cost and divides by sellable quantity itself (pricing-v2.ts).
 */
export function stockCostTotal(perPieceDzd: number | null | undefined, quantity: number): number | null {
  if (typeof perPieceDzd !== "number" || !Number.isFinite(perPieceDzd) || perPieceDzd <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return perPieceDzd * quantity;
}

// ---------- break-even presentation ----------

export type BreakEvenKey = keyof ScenarioResult["breakEven"];

/**
 * D52: a null break-even is either a MISSING input ("—") or "Not possible"
 * (inputs are all there, the price just cannot cover the costs). Classification
 * only; the numbers come from the engine.
 */
export function breakEvenState(r: ScenarioResult, key: BreakEvenKey): "value" | "missing" | "impossible" {
  if (r.breakEven[key] !== null) return "value";
  const complete = r.finalPrice !== null && r.totalCost !== null && r.adCostPerDeliveredUsd !== null;
  if (complete || (r.totalCost !== null && r.k !== null && r.k >= 1)) return "impossible";
  return "missing";
}

/** Real column: strictly negative profit per piece is "below break-even" (0 is not). */
export const realBelow = (profitPerPiece: number | null): boolean => profitPerPiece !== null && profitPerPiece < 0;

/**
 * Real column with data but a rate of exactly 0 (nothing confirmed / nothing delivered):
 * the engine rejects 0 (null results), but the truth is "impossible", the worst loss.
 * With an ad cost of exactly 0 the confirmation rate drops out of the engine, so a 0
 * confirmation is then not a loss on its own. Scenario columns keep the engine's validation.
 */
export const realZeroRate = (
  hasData: boolean,
  input: { confirm: number | null; delivery: number | null },
  adCostUsd?: number | null,
): boolean => hasData && ((input.confirm === 0 && adCostUsd !== 0) || input.delivery === 0);

type RealRow = { key: string; breakEven?: BreakEvenKey; isInput?: boolean };
const AD_TOTAL_ROWS = ["ordersNeeded", "totalAdUsd", "totalAdDzd"];
/**
 * Rows that still depend on c when ad = 0: the ad totals (divide by c) and maxAdCostUsd
 * (room * c * d / B: at c = 0 any ad spend is a pure loss, so the rate-1 value would mislead).
 * adCostPerDeliveredUsd is NOT here: it is ad / (c * d) = 0 for ad = 0, so "alt" (0) is right.
 */
const C_DEPENDENT_ROWS = [...AD_TOTAL_ROWS, "maxAdCostUsd"];

/**
 * How one Real-column row is drawn when a rate is exactly 0 (the engine rejects 0):
 * "alt" = read it from the engine run with the zero rate set to 1 (the row does not depend
 * on that rate: the final price echo, the zero rate's own break-even); "impossible" = every
 * other dependent row; "normal" = no zero rate, an input row, or the rate-1 run has missing inputs.
 * Ad cost exactly 0: confirmation drops out of the engine, so with c = 0 every row is "alt"
 * except the order count and ad totals (they divide by c).
 */
export function realZeroRowMode(
  input: { confirm: number | null; delivery: number | null },
  row: RealRow,
  rateOneComplete: boolean,
  adCostUsd?: number | null,
): "normal" | "impossible" | "alt" {
  const dZero = input.delivery === 0;
  const cZero = input.confirm === 0;
  if (!(dZero || cZero) || row.isInput || !rateOneComplete) return "normal";
  if (row.key === "finalPrice") return "alt";
  const cDrops = cZero && adCostUsd === 0;
  if (cDrops && !dZero) return C_DEPENDENT_ROWS.includes(row.key) ? "impossible" : "alt";
  const cEff = cZero && !cDrops;
  if (dZero && !cEff && row.breakEven === "minDelivery") return "alt";
  if (cEff && !dZero && row.breakEven === "minConfirmation") return "alt";
  return "impossible";
}

/**
 * One Real-column cell: the drawn state and which engine run it reads
 * ("rateOne" = the run with the zero rate set to 1). Pure lookup for the JSX.
 */
export function realCellState(
  mode: "normal" | "impossible" | "alt",
  real: { result: ScenarioResult; rateOne: ScenarioResult | null; input: ScenarioInput },
  row: RealRow & { get: (r: ScenarioResult) => number | null; input?: (i: ScenarioInput) => number | null },
): { state: "value" | "missing" | "impossible"; srcKey: "result" | "rateOne"; value: number | null } {
  const srcKey = mode === "alt" && real.rateOne ? "rateOne" : "result";
  const src = srcKey === "rateOne" ? real.rateOne! : real.result;
  const value = row.input ? row.input(real.input) : row.get(src);
  const state = mode === "impossible" ? "impossible" : row.breakEven ? breakEvenState(src, row.breakEven) : value === null ? "missing" : "value";
  return { state, srcKey, value };
}

/** True when at least one drawn Real cell (data present) is "impossible"; drives the footer. */
export function anyRealImpossible(
  real: { result: ScenarioResult; rateOne: ScenarioResult | null; input: ScenarioInput; hasData: boolean },
  rows: (RealRow & { get: (r: ScenarioResult) => number | null; input?: (i: ScenarioInput) => number | null })[],
): boolean {
  if (!real.hasData) return false;
  const rateOneComplete = !!real.rateOne && real.rateOne.totalCost !== null;
  return rows.some((row) => {
    const mode = realZeroRowMode(real.input, row, rateOneComplete, real.input.adCostUsd);
    return realCellState(mode, real, row).state === "impossible";
  });
}

/** The Real profit-per-piece value actually drawn (rate-1 run when the row is "alt"); null when not a value. */
export function realDrawnProfit(real: {
  result: ScenarioResult;
  rateOne: ScenarioResult | null;
  input: ScenarioInput;
  hasData: boolean;
}): number | null {
  if (!real.hasData) return null;
  const row = { key: "profitPerPiece", get: (r: ScenarioResult) => r.profitPerPiece };
  const mode = realZeroRowMode(real.input, row, !!real.rateOne && real.rateOne.totalCost !== null, real.input.adCostUsd);
  const cell = realCellState(mode, real, row);
  return cell.state === "value" ? cell.value : null;
}

/** Footer line "no orders confirmed or delivered": both rates exactly 0 and ad cost not 0 (null counts as not 0). */
export const realBothZero = (
  hasData: boolean,
  input: { confirm: number | null; delivery: number | null },
  adCostUsd?: number | null,
): boolean => hasData && input.confirm === 0 && input.delivery === 0 && adCostUsd !== 0;

/** Real column loses money: negative profit, or a zero rate with data. */
export const realLosing = (
  hasData: boolean,
  input: { confirm: number | null; delivery: number | null },
  profitPerPiece: number | null,
  adCostUsd?: number | null,
): boolean => hasData && (realZeroRate(hasData, input, adCostUsd) || realBelow(profitPerPiece));

/** Sale price strictly below the medium break-even selling price; null on either side -> no badge. */
export const saleBelowBreakEven = (salePrice: number | null, minSellingPrice: number | null): boolean =>
  salePrice !== null && minSellingPrice !== null && salePrice < minSellingPrice;

export const TARGET_MODES: readonly TargetMode[] = ["profit", "markup"];

/** Radio-group arrow keys: the mode to move to, or null when the key does nothing. Arrows mirror in RTL. */
export function targetModeForKey(current: TargetMode, key: string, rtl: boolean): TargetMode | null {
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  const i = TARGET_MODES.indexOf(current);
  let n: number;
  if (key === forward || key === "ArrowDown") n = i + 1;
  else if (key === back || key === "ArrowUp") n = i - 1;
  else return null;
  return TARGET_MODES[(n + TARGET_MODES.length) % TARGET_MODES.length];
}
