import { useTranslations } from "next-intl";

/** Localized audit table label, or the raw table name when no translation exists. One lookup for filter bar and rows. */
export function useTableLabel() {
  const t = useTranslations();
  return (n: string) => (t.has(`audit.tables.${n}`) ? t(`audit.tables.${n}`) : n);
}
