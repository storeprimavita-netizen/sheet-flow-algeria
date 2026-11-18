import { useTranslations } from "next-intl";

/** Skeleton shared by every Store screen. */
export default function StoreLoading() {
  const t = useTranslations("store.admin");
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t("loading")}>
      <div className="space-y-2">
        <div className={`${bar} h-4 w-40`} />
        <div className={`${bar} h-8 w-64`} />
        <div className={`${bar} h-4 w-96 max-w-full`} />
      </div>
      <div className="card-surface space-y-3 rounded-xl p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${bar} h-8`} />
        ))}
      </div>
    </div>
  );
}
