/**
 * Actual P&L metrics: raw lines from SQL `pnl_lines()` (migration 00022) turned
 * into margin, AOV and break-even delivery rate. The pricing calculator is
 * `pricing-v2.ts`; rates, ROAS and CPA come from SQL `kpi_lines` (`kpi.ts`).
 */

/** Raw P&L lines returned by `pnl_summary()` / `dashboard_stats().pnl`. */
export type PnlLines = {
  period_from: string;
  period_to: string;
  days: number;
  orders_received: number;
  orders_confirmed: number;
  orders_delivered: number;
  orders_returned: number;
  orders_cancelled: number;
  revenue: number;
  cogs: number;
  return_fee_unit: number;
  return_fees: number;
  ad_spend_test: number;
  ad_spend_scaling: number;
  ad_spend: number;
  expenses: number;
  fixed_fees_monthly: number;
  fixed_share: number;
  fixed_fees: number;
  net_profit: number;
  cash_to_collect: number;
};

export type PnlMetrics = {
  /** revenue − every cost line (equals the SQL net_profit). */
  total_costs: number;
  /** % of revenue kept; null with no revenue. */
  margin_pct: number | null;
  /** average revenue per delivered order. */
  aov: number | null;
  /**
   * Delivery rate (%) on confirmed orders at which this period's net turns 0,
   * holding volume, AOV, unit cost and period costs fixed. Every confirmed
   * order is assumed to end delivered or returned (the sheet's assumption):
   *   net(d) = C·d·(AOV − unitCOGS) − C·(1−d)·returnFee − periodCosts = 0
   *   ⇒ d = (periodCosts + C·returnFee) / (C·(AOV − unitCOGS + returnFee))
   * null when undefined (no confirmed/delivered orders, or no unit margin);
   * may exceed 100 → "unreachable at these costs".
   */
  breakeven_delivery_pct: number | null;
};

const pct = (a: number, b: number): number | null => (b ? Math.round((a / b) * 1000) / 10 : null);
const per = (a: number, b: number): number | null => (b ? a / b : null);

export function pnlMetrics(l: PnlLines): PnlMetrics {
  const periodCosts = l.ad_spend + l.expenses + l.fixed_fees;
  const aov = per(l.revenue, l.orders_delivered);
  const unitCogs = per(l.cogs, l.orders_delivered) ?? 0;
  const C = l.orders_confirmed;
  const unitSpread = aov == null ? 0 : aov - unitCogs + l.return_fee_unit;
  const breakeven =
    aov != null && C > 0 && unitSpread > 0
      ? Math.round(((periodCosts + C * l.return_fee_unit) / (C * unitSpread)) * 1000) / 10
      : null;
  return {
    total_costs: l.revenue - l.net_profit,
    margin_pct: pct(l.net_profit, l.revenue),
    aov,
    breakeven_delivery_pct: breakeven,
  };
}

/** Narrow an RPC jsonb (`pnl_summary`, `pnl_by_product.pnl`) — null for agents. */
export const asPnl = (j: unknown): PnlLines | null => (j && typeof j === "object" ? (j as PnlLines) : null);
