/** Table-shaped skeleton for the product Selling tab. */
export default function SellingLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-5 w-40`} />
        <div className={`${bar} h-4 w-96 max-w-full`} />
      </div>
      <div className="card-surface grid grid-cols-1 gap-3 rounded-xl p-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${bar} h-9`} />
        ))}
      </div>
      <div className="card-surface space-y-3 rounded-xl p-4">
        <div className={`${bar} h-8`} />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`${bar} h-6`} />
        ))}
      </div>
    </div>
  );
}
