/** Skeleton for the audit log: header, tabs, filter bar, table. */
export default function AuditLoading() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-8 w-48`} />
        <div className={`${bar} h-4 w-64 max-w-full`} />
      </div>
      <div className={`${bar} h-9 w-full max-w-md`} />
      <div className={`${bar} h-9 w-full`} />
      <div className="card-surface space-y-3 rounded-xl p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${bar} h-6`} />
        ))}
      </div>
    </div>
  );
}
