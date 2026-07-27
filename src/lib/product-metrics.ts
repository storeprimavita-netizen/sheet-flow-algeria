/**
 * Per-product actuals net profit (SPEC §4) — one home for the formula so the
 * Statistics tab and the Products card grid never drift. Fixed fees have no
 * date range yet, so "the period" is all-time: workspace fixed-fee total ×
 * this product's share of all delivered orders workspace-wide.
 *
 *   net_profit = revenue
 *              − sourcing_cost_dzd × orders_delivered   (per-unit cost × units shipped)
 *              − expenses_dzd − ad_spend_dzd
 *              − fixed_fees_total_dzd × (this.orders_delivered / total_delivered)
 */
export type ProductActuals = {
  revenue_dzd: number | null;
  sourcing_cost_dzd: number | null;
  expenses_dzd: number | null;
  ad_spend_dzd: number | null;
  orders_delivered: number | null;
};

export function netProfit(stats: ProductActuals, fixedFeesTotalDzd: number, totalDelivered: number) {
  const delivered = stats.orders_delivered ?? 0;
  const share = totalDelivered > 0 ? delivered / totalDelivered : 0;
  const allocatedFixedFees = fixedFeesTotalDzd * share;
  const sourcingDelivered = (stats.sourcing_cost_dzd ?? 0) * delivered;
  const net =
    (stats.revenue_dzd ?? 0) - sourcingDelivered - (stats.expenses_dzd ?? 0) - (stats.ad_spend_dzd ?? 0) - allocatedFixedFees;
  return { allocatedFixedFees, net };
}
