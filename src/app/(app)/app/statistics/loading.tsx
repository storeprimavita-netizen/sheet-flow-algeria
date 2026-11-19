/** Skeleton for the statistics page (filter bar, wilaya table beside the map). */
export default function StatisticsLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-7 w-48`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="card-surface h-44 w-full rounded-xl sm:h-32" />
      <div className="card-surface grid grid-cols-1 gap-5 rounded-xl p-5 2xl:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${bar} h-9 w-full`} />
          ))}
        </div>
        <div className={`${bar} h-72 w-full 2xl:w-[280px]`} />
      </div>
    </div>
  );
}
