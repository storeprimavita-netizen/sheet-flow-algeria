/** Skeleton for the product Stock tab. */
export default function StockLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className={`${bar} card-surface h-16 rounded-xl`} />
      <div className="card-surface space-y-3 rounded-xl p-5">
        <div className={`${bar} h-5 w-40`} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${bar} h-8`} />
        ))}
      </div>
      <div className="card-surface space-y-3 rounded-xl p-5">
        <div className={`${bar} h-8`} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${bar} h-6`} />
        ))}
      </div>
    </div>
  );
}
