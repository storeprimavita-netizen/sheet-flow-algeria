import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

const MODULES = [
  "Products",
  "Orders",
  "Contacts",
  "Expenses",
  "BI",
  "Settings",
] as const;

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((key) => (
          <div key={key} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`modules.${key}.title`)}
              </span>
              <Badge variant="outline">{t("soon")}</Badge>
            </div>
            <p className="mt-2 text-sm">{t(`modules.${key}.desc`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
