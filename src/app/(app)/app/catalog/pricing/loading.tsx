/** Skeleton for the pricing portfolio: header, summary cards, table. */
export default function PricingPortfolioLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-8 w-48`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${bar} h-20`} />
        ))}
      </div>
      <div className="card-surface space-y-3 rounded-xl p-4">
        <div className={`${bar} h-8`} />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${bar} h-6`} />
        ))}
      </div>
    </div>
  );
}
