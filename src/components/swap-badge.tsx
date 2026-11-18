"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderNo } from "@/components/order-no";
import { formatOrderNo, ltr } from "@/lib/format";
import { Chip } from "@/components/ui/chip";

/** "Swapped to order #B" marker for an original linked to its replacement (D44), whatever its carrier status. */
export function SwapBadge({ to }: { to: { id: string; orderSeq: number } }) {
  const t = useTranslations("orders.swap");
  const number = ltr(formatOrderNo(to.orderSeq));
  const label = t("swappedTo", { number });
  return (
    <Link href={`/app/orders/${to.id}`} title={label} aria-label={label} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full shrink-0">
      <Chip token="violet" size="sm" icon={<ArrowRightLeft className="h-3 w-3 shrink-0 rtl:-scale-x-100" />}>
        <span className="whitespace-nowrap">{t("badge")} <OrderNo seq={to.orderSeq} className="num" /></span>
      </Chip>
    </Link>
  );
}
