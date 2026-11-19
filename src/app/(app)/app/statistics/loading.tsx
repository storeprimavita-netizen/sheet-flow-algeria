/** Skeleton for /app/statistics (same grid as page.tsx). */
export default function StatisticsLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-7 w-48`} />
        <div className={`${bar} h-4 w-96 max-w-full`} />
      </div>
      <div className={`${bar} h-16 w-full sm:w-[32rem]`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
        <div className="card-surface h-96 rounded-xl" />
        <div className="card-surface h-96 rounded-xl lg:w-[320px]" />
      </div>
    </div>
  );
}
