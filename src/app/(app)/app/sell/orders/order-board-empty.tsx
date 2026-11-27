import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import type { ViewScope } from "@/lib/order-views";

export async function OrderBoardEmpty({
  scope, filtered, resetHref, isAdmin, search,
}: {
  scope: ViewScope;
  filtered: boolean;
  resetHref: string;
  isAdmin: boolean;
  search?: { q: string; clearHref: string };
}) {
  const t = await getTranslations("orders");
  const hint = scope === "confirmation" ? "confirmationEmptyHint" : scope === "shipping" ? "deliveryEmptyHint" : "emptyHint";
  const fallback = scope === "shipping"
    ? { href: "/app/sell/shipping?show=all", label: t("showClosed") }
    : isAdmin ? { href: "/app/sell/orders/new", label: t("new") }
    : { href: "/app/sell/confirmation?show=all", label: t("showClosed") };

  if (search) {
    return (
      <Empty>
        <p className="font-medium text-foreground">{t("noMatch", { q: search.q })}</p>
        <p className="mt-1">{t("noMatchHint")}</p>
        <ButtonLink className="mt-3" href={search.clearHref} size="sm">{t("clearSearch")}</ButtonLink>
      </Empty>
    );
  }

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
