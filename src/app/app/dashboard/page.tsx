import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const MODULES = ["Products", "Orders", "Contacts", "Expenses", "BI", "Settings"] as const;

const HREF: Partial<Record<(typeof MODULES)[number], string>> = {
  Products: "/app/products",
  Orders: "/app/orders",
  Contacts: "/app/contacts",
  Expenses: "/app/expenses",
};

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((key) => {
          const href = HREF[key];
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t(`modules.${key}.title`)}
                </span>
                {href ? (
                  <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                ) : (
                  <Badge variant="outline">{t("soon")}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t(`modules.${key}.desc`)}</p>
            </>
          );

          return href ? (
            <Link
              key={key}
              href={href}
              className="glass-card rounded-xl p-5 transition-colors hover:bg-muted/30"
            >
              {inner}
            </Link>
          ) : (
            <div key={key} className="glass-card rounded-xl p-5 opacity-70">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
