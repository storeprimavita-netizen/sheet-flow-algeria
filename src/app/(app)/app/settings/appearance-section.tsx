"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type Density = "comfortable" | "compact";

/** Theme (dark/light, cookie-backed) + the workspace-wide default row density new tables fall back to. */
export function AppearanceSection() {
  const t = useTranslations();
  const [density, setDensity] = React.useState<Density>("comfortable");

  React.useEffect(() => {
    const saved = localStorage.getItem("mnw:density:default");
    setDensity(saved === "compact" ? "compact" : "comfortable");
  }, []);

  function choose(d: Density) {
    setDensity(d);
    localStorage.setItem("mnw:density:default", d);
  }

  return (
    <section id="appearance" className="card-surface scroll-mt-20 space-y-5 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.appearance")}</h2>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("settings.theme")}</p>
        <ThemeToggle className="w-auto" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("settings.density")}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={density === "comfortable" ? "default" : "outline"}
            size="sm"
            onClick={() => choose("comfortable")}
          >
            {t("table.comfortable")}
          </Button>
          <Button
            type="button"
            variant={density === "compact" ? "default" : "outline"}
            size="sm"
            onClick={() => choose("compact")}
          >
            {t("table.compact")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.densityHint")}</p>
      </div>
    </section>
  );
}
