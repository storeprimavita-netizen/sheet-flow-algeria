export default function MyDayLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-7 w-40`} />
        <div className={`${bar} h-4 w-72 max-w-full`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card-surface space-y-3 rounded-xl p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-7 w-16`} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card-surface space-y-3 rounded-xl p-4">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className={`${bar} h-6`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
