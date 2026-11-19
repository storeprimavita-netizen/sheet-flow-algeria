"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { ButtonLink } from "@/components/button-link";
import { Field } from "@/components/field";
import { Combobox } from "@/components/ui/combobox";

const STATUSES = ["all", "approved", "hidden"] as const;
export type ReviewStatusFilter = (typeof STATUSES)[number];

function href(product: string, status: string) {
  const q = new URLSearchParams();
  if (product) q.set("product", product);
  if (status && status !== "all") q.set("status", status);
  const s = q.toString();
  return `/app/store/reviews${s ? `?${s}` : ""}`;
}

/** Filters live in the URL (search params), so a filtered list can be shared and survives refresh. */
export function ReviewFilters({ products, product, status }: { products: { id: string; name: string }[]; product: string; status: ReviewStatusFilter }) {
  const t = useTranslations("store.admin.reviews");
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label={t("filterProduct")} className="w-full sm:w-72">
        <Combobox
          value={product}
          onChange={(v) => router.push(href(v, status))}
          options={[{ value: "", label: t("allProducts") }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
          ariaLabel={t("filterProduct")}
          placeholder={t("allProducts")}
          searchPlaceholder={t("searchProduct")}
          emptyText={t("noProductsFound")}
        />
      </Field>
      <nav aria-label={t("filterStatus")} className="flex gap-2">
        {STATUSES.map((s) => (
          <ButtonLink key={s} href={href(product, s)} variant={s === status ? "default" : "outline"} size="sm">
            {t(s)}
          </ButtonLink>
        ))}
      </nav>
    </div>
  );
}
