/** Skeleton for the six dashboard bands (same grid as page.tsx). */
export default function DashboardLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  const card = (h: string) => <div className={`card-surface rounded-xl ${h}`} />;
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-7 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>{card("h-24")}</div>
          ))}
        </div>
        <div className="lg:col-span-12">{card("h-20")}</div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>{card("h-28")}</div>
          ))}
        </div>
        <div className="lg:col-span-5">{card("h-64")}</div>
        <div className="lg:col-span-7">{card("h-64")}</div>
        <div className="lg:col-span-12">{card("h-40")}</div>
        <div className="lg:col-span-12">{card("h-56")}</div>
      </div>
    </div>
  );
}
