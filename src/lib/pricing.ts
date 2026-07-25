/**
 * BENZ Pricing COD unit-economics model — exact replica of the spreadsheet
 * (supabase root: "BENZ Pricing (31).xlsx"). Three scenarios: best / medium / worst.
 *
 * Inputs are the only thing stored (pricing_scenarios.inputs jsonb); every
 * derived number below is recomputed in the UI so the math always matches the
 * sheet and never drifts.
 */

export type ScenarioSlug = "best" | "medium" | "worst";
export const SCENARIO_SLUGS: ScenarioSlug[] = ["best", "medium", "worst"];

/** The 14 spreadsheet inputs. All numeric; the sheet leaves WORST blank (0). */
export type PricingInputs = {
  product_price: number; // D7  product COGS (DA)
  euro_price: number; // C8  EUR→DZD rate
  lead_cost_eur: number; // E8  cost per lead (€)
  confirmation_pct: number; // C9  % of leads that confirm
  delivery_pct: number; // C10 % of confirmed that deliver
  delivery_price: number; // E11 per-order delivery surcharge (DA)
  confirmation_agent: number; // E12 confirmation-agent commission/order (DA)
  packaging_fees: number; // E13 packaging/order (DA)
  sale_price: number; // E16 sale price (DA)
  spend_eur_day: number; // H8  daily ad spend (€)
  delivery_fee_da: number; // H9  courier fee per shipped parcel (DA)
  flexy_month: number; // I13 flexy / "proxy & tools" (DA/month)
  location_day: number; // H14 rent + electricity (DA/day)
  salary_month: number; // I15 employee salary (DA/month)
};

export type PricingField = keyof PricingInputs;
export type FieldGroup = "funnel" | "perOrder" | "fixed";

export const PRICING_FIELDS: {
  key: PricingField;
  group: FieldGroup;
  percent?: boolean;
  currency?: boolean;
  euro?: boolean;
}[] = [
  { key: "euro_price", group: "funnel" },
  { key: "lead_cost_eur", group: "funnel", euro: true },
  { key: "confirmation_pct", group: "funnel", percent: true },
  { key: "delivery_pct", group: "funnel", percent: true },
  { key: "spend_eur_day", group: "funnel", euro: true },
  { key: "delivery_fee_da", group: "funnel", currency: true },
  { key: "product_price", group: "perOrder", currency: true },
  { key: "sale_price", group: "perOrder", currency: true },
  { key: "delivery_price", group: "perOrder", currency: true },
  { key: "confirmation_agent", group: "perOrder", currency: true },
  { key: "packaging_fees", group: "perOrder", currency: true },
  { key: "flexy_month", group: "fixed", currency: true },
  { key: "location_day", group: "fixed", currency: true },
  { key: "salary_month", group: "fixed", currency: true },
];

/** BEST scenario values straight from the sheet — used to seed fresh scenarios. */
export const DEFAULT_INPUTS: PricingInputs = {
  product_price: 2500,
  euro_price: 255,
  lead_cost_eur: 2,
  confirmation_pct: 65,
  delivery_pct: 65,
  delivery_price: 0,
  confirmation_agent: 0,
  packaging_fees: 50,
  sale_price: 4900,
  spend_eur_day: 20,
  delivery_fee_da: 100,
  flexy_month: 0,
  location_day: 100,
  salary_month: 5000,
};

/** Coerce arbitrary jsonb (missing keys / strings) into a complete inputs object. */
export function normalizeInputs(raw: unknown): PricingInputs {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_INPUTS };
  for (const k of Object.keys(out) as PricingField[]) {
    const n = Number(r[k]);
    out[k] = Number.isFinite(n) ? n : DEFAULT_INPUTS[k];
  }
  return out;
}

/** Seed for a product: BEST defaults, but prefill COGS + sale price from the row. */
export function seedForProduct(costTotal: number, sellingPrice: number | null): PricingInputs {
  return {
    ...DEFAULT_INPUTS,
    product_price: Number.isFinite(costTotal) && costTotal > 0 ? costTotal : DEFAULT_INPUTS.product_price,
    sale_price: Number.isFinite(sellingPrice as number) && (sellingPrice as number) > 0 ? (sellingPrice as number) : DEFAULT_INPUTS.sale_price,
  };
}

const fin = (x: number): number => (Number.isFinite(x) ? x : 0);
const div = (a: number, b: number): number => (b ? a / b : 0);

export type ScenarioResult = {
  // funnel
  confirmation_cost_da: number; // E9 ad cost per confirmed order
  delivery_cost_da: number; // E10 ad cost per delivered order
  confirmed_per_day: number; // H10
  delivered_per_day: number; // H11
  confirmed_per_month: number; // I10
  delivered_per_month: number; // I11
  spend_eur_month: number; // I8
  // per-order P&L
  returns_fee: number; // E14 = H12
  other_fee_per_order: number; // E15 = H16
  cost_per_order: number; // sum of all per-order cost lines
  net_profit_per_order: number; // E17
  // scaling
  net_profit_per_day: number; // H17
  net_profit_per_month: number; // I17
};

/**
 * Reproduce the spreadsheet formulas cell-for-cell. Every division is guarded
 * so empty inputs (WORST) yield 0 instead of #DIV/0!.
 */
export function computeScenario(i: Partial<PricingInputs>): ScenarioResult {
  const product_price = fin(i.product_price ?? 0);
  const euro = fin(i.euro_price ?? 0);
  const lead = fin(i.lead_cost_eur ?? 0);
  const confirmPct = fin(i.confirmation_pct ?? 0);
  const deliveryPct = fin(i.delivery_pct ?? 0);
  const delivery_price = fin(i.delivery_price ?? 0);
  const confirmation_agent = fin(i.confirmation_agent ?? 0);
  const packaging = fin(i.packaging_fees ?? 0);
  const sale = fin(i.sale_price ?? 0);
  const spend = fin(i.spend_eur_day ?? 0);
  const delivery_fee = fin(i.delivery_fee_da ?? 0);
  const flexy_month = fin(i.flexy_month ?? 0);
  const location_day = fin(i.location_day ?? 0);
  const salary_month = fin(i.salary_month ?? 0);

  // E9 = (euro * lead * 100) / confirm%   [= (euro*lead) / (confirm%/100)]
  const confirmation_cost_da = div(euro * lead * 100, confirmPct);
  // E10 = (E9 * 100) / delivery%
  const delivery_cost_da = div(confirmation_cost_da * 100, deliveryPct);

  const dailyAdDa = spend * euro; // €/day × DZD/€
  // H10 = (spend * euro) / E9 ;  H11 = (spend * euro) / E10
  const confirmed_per_day = div(dailyAdDa, confirmation_cost_da);
  const delivered_per_day = div(dailyAdDa, delivery_cost_da);

  // H12 = (confirmed − delivered) * (delivery_fee / delivered)   [extra courier cost / delivered order]
  const returns_fee = (confirmed_per_day - delivered_per_day) * div(delivery_fee, delivered_per_day);

  // fixed costs → per-delivered-order share (H16)
  const flexy_daily = div(flexy_month, 30);
  const salary_daily = div(salary_month, 30);
  const other_fee_per_order = div(flexy_daily + location_day + salary_daily, delivered_per_day);

  // E17 = sale − (product + delivery_cost_da + delivery_price + agent + packaging + returns + other)
  const cost_per_order =
    product_price +
    delivery_cost_da +
    delivery_price +
    confirmation_agent +
    packaging +
    returns_fee +
    other_fee_per_order;
  const net_profit_per_order = sale - cost_per_order;

  // H17 = E17 * delivered/day ;  I17 = H17 * 30
  const net_profit_per_day = net_profit_per_order * delivered_per_day;
  const net_profit_per_month = net_profit_per_day * 30;

  return {
    confirmation_cost_da,
    delivery_cost_da,
    confirmed_per_day,
    delivered_per_day,
    confirmed_per_month: confirmed_per_day * 30,
    delivered_per_month: delivered_per_day * 30,
    spend_eur_month: spend * 30,
    returns_fee,
    other_fee_per_order,
    cost_per_order,
    net_profit_per_order,
    net_profit_per_day,
    net_profit_per_month,
  };
}
