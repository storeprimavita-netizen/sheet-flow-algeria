/** Skeleton for every /app section while its server component streams:
 * header, KPI row, then a table — the shape most pages share. */
export default function AppLoading() {
  const bar = "animate-pulse rounded-md bg-surface-raised";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-7 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card-surface space-y-3 rounded-xl p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-7 w-32`} />
          </div>
        ))}
      </div>
      <div className="card-surface space-y-3 rounded-xl p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${bar} h-8`} />
        ))}
      </div>
    </div>
  );
}
