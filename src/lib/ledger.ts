/**
 * Pure account-ledger rules (MONEY-2). They mirror the checks in the MONEY-1
 * RPCs (00083–00085) so the screen never offers what the database will refuse.
 */
import { z } from "zod";

export const ACCOUNT_KINDS = ["zr", "dzd", "usdt"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const kindCurrency = (kind: AccountKind) => (kind === "usdt" ? "USDT" : "DZD");

/* ── Transfers DZD ↔ USDT ─────────────────────────────────────────────
 * The DB demands round(usdt * rate, 2) = dzd, with rate ≤ 8 dp and USDT ≤ 6 dp.
 * Scaled integers (BigInt) keep floats out of that comparison. */

export type TransferFrom = "DZD" | "USDT";

const scaled = (v: number, dp: number) => BigInt(v.toFixed(dp).replace(".", ""));
const unscaled = (v: bigint, dp: number) => Number(v) / 10 ** dp;
/** Half-up division of non-negative integers (Postgres numeric rounding). */
const divRound = (a: bigint, b: bigint) => (a + b / BigInt(2)) / b;
const pow = (n: number) => BigInt("1" + "0".repeat(n));

const usable = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0 && v < 1e14;

/** The DB rate check, exactly. */
export function transferAgrees(from: TransferFrom, amountOut: number, amountIn: number, rate: number): boolean {
  if (!usable(amountOut) || !usable(amountIn) || !usable(rate) || rate >= 1e8) return false;
  const [dzd, usdt] = from === "DZD" ? [amountOut, amountIn] : [amountIn, amountOut];
  if (Number(dzd.toFixed(2)) !== dzd || Number(usdt.toFixed(6)) !== usdt || Number(rate.toFixed(8)) !== rate) return false;
  // usdt(1e6) * rate(1e8) → 1e14; to cents (1e2) divides by 1e12.
  return divRound(scaled(usdt, 6) * scaled(rate, 8), pow(12)) === scaled(dzd, 2);
}

/** The rate that links two typed amounts (editing "amount in" recomputes it). */
export function rateFromAmounts(from: TransferFrom, amountOut: number, amountIn: number): number | null {
  if (!usable(amountOut) || !usable(amountIn)) return null;
  const [dzd, usdt] = from === "DZD" ? [amountOut, amountIn] : [amountIn, amountOut];
  const u = scaled(usdt, 6);
  if (u === BigInt(0)) return null;
  // dzd(1e2) / usdt(1e6) at 8 dp → multiply by 1e12.
  const rate = unscaled(divRound(scaled(dzd, 2) * pow(12), u), 8);
  return transferAgrees(from, amountOut, amountIn, rate) ? rate : null;
}

/** Amount received for a typed amount out and rate. When 6 USDT decimals cannot
 * carry the typed rate exactly (very large rates), the rate is nudged to match. */
export function quoteTransfer(from: TransferFrom, amountOut: number, rate: number): { amountIn: number; rate: number } | null {
  if (!usable(amountOut) || !usable(rate) || rate >= 1e8) return null;
  const r = scaled(rate, 8);
  if (r === BigInt(0)) return null;
  const amountIn = from === "USDT"
    ? unscaled(divRound(scaled(amountOut, 6) * r, pow(12)), 2)
    : unscaled(divRound(scaled(amountOut, 2) * pow(12), r), 6);
  if (transferAgrees(from, amountOut, amountIn, Number(rate.toFixed(8)))) return { amountIn, rate: Number(rate.toFixed(8)) };
  const adjusted = rateFromAmounts(from, amountOut, amountIn);
  return adjusted === null ? null : { amountIn, rate: adjusted };
}

/* ── Balances ───────────────────────────────────────────────────────── */

/** DZD value of the three balances; null without a USDT rate. */
export function dzdTotal(balances: Record<AccountKind, number>, usdtRate: number | null): number | null {
  if (usdtRate === null || !(usdtRate > 0)) return null;
  const cents = (v: number) => Math.round(v * 100);
  return (cents(balances.zr) + cents(balances.dzd) + cents(balances.usdt * usdtRate)) / 100;
}

/** Threshold 0 means "no warning". */
export const isLowBalance = (balance: number, threshold: number) => threshold > 0 && balance <= threshold;

/** Today as an Algiers calendar day (D46). */
export const algiersToday = (now: Date = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });

/* ── Corrections ────────────────────────────────────────────────────── */

export type ReversibleEntry = {
  id: string;
  expense_id: string | null;
  ad_spend_id: string | null;
  legacy_mapping_id: string | null;
  reverses_entry_id: string | null;
};

export function canReverse(entry: ReversibleEntry, reversed: ReadonlySet<string>): boolean {
  return !entry.expense_id && !entry.ad_spend_id && !entry.legacy_mapping_id && !entry.reverses_entry_id
    && !reversed.has(entry.id);
}

/* ── Legacy accounts (D97) ──────────────────────────────────────────── */

export const legacySourceSchema = z.object({
  source_key: z.string(),
  source_type: z.enum(["opening", "topup", "entry", "expense", "ad_spend"]),
  amount: z.number(),
  currency: z.string(),
  occurred_on: z.string(),
  direction: z.enum(["in", "out"]),
  fx_rate: z.number().nullable(),
  amount_dzd: z.number().nullable(),
  direct_debit_posting: z.boolean(),
});
export type LegacySource = z.infer<typeof legacySourceSchema>;

export const legacyPreviewSchema = z.array(z.object({
  account_id: z.string(),
  name: z.string(),
  currency: z.string(),
  balance: z.number().nullable(),
  posted: z.boolean(),
  previous_mapping_id: z.string().nullable(),
  previous_kind: z.enum(ACCOUNT_KINDS).nullable(),
  proposed_kind: z.enum(ACCOUNT_KINDS).nullable(),
  invalid_links: z.boolean(),
  sources: z.array(legacySourceSchema),
}));
export type LegacyAccount = z.infer<typeof legacyPreviewSchema>[number];

const inRange = (v: number) => v > -1e14 && v < 1e14;

/** The amount `legacy_mapping_plan` (00085) can take over unchanged, else null. */
export function exactAmount(source: LegacySource, kind: AccountKind): number | null {
  if (!inRange(source.amount)) return null;
  const currency = kindCurrency(kind);
  const debit = source.source_type === "expense" || source.source_type === "ad_spend";
  if (source.currency === currency) return Math.abs(source.amount);
  if (source.amount === 0 && (!debit || source.amount_dzd === 0)) return 0;
  const fx = source.fx_rate;
  const dzd = source.amount_dzd;
  if (debit && currency === "DZD" && fx !== null && fx > 0 && fx < 1e8 && fx !== 1
    && dzd !== null && dzd >= 0 && dzd < 1e14) return dzd;
  return null;
}

/** True when the admin has to type the converted amount and its evidence. */
export function needsConversion(source: LegacySource, kind: AccountKind): boolean {
  return source.amount !== 0 && inRange(source.amount) && exactAmount(source, kind) === null;
}
