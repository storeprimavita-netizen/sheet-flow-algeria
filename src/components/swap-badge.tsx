"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";

/** "Swapped to order #B" marker for an original linked to its replacement (D44), whatever its carrier status. */
export function SwapBadge({ to }: { to: { id: string; orderNumber: string | null } }) {
  const t = useTranslations("orders.swap");
  const label = t("swappedTo", { number: to.orderNumber ?? to.id.slice(0, 8) });
  return (
    <Link href={`/app/orders/${to.id}`} title={label} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full min-w-0">
      <Chip token="violet" size="sm" className="min-w-0" icon={<ArrowRightLeft className="h-3 w-3 shrink-0 rtl:-scale-x-100" />}>
        <span className="truncate">{label}</span>
      </Chip>
    </Link>
  );
}
