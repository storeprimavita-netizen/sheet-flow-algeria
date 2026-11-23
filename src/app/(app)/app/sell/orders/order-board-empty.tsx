import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import type { ViewScope } from "@/lib/order-views";

export async function OrderBoardEmpty({
  scope, filtered, resetHref, isAdmin,
}: {
  scope: ViewScope;
  filtered: boolean;
  resetHref: string;
  isAdmin: boolean;
}) {
  const t = await getTranslations("orders");
  const hint = scope === "confirmation" ? "confirmationEmptyHint" : scope === "shipping" ? "deliveryEmptyHint" : "emptyHint";
  const fallback = scope === "shipping"
    ? { href: "/app/sell/shipping?show=all", label: t("showClosed") }
    : isAdmin ? { href: "/app/sell/orders/new", label: t("new") }
    : { href: "/app/sell/confirmation?show=all", label: t("showClosed") };

  return (
    <Empty>
      <p className="font-medium text-foreground">{t("none")}</p>
      <p className="mt-1">{t(filtered ? "emptyHint" : hint)}</p>
      <ButtonLink className="mt-3" href={filtered ? resetHref : fallback.href} size="sm">
        {filtered ? t("clearFilters") : fallback.label}
      </ButtonLink>
    </Empty>
  );
}
