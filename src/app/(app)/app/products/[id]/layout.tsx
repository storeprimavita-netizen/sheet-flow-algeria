import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { StatusPill } from "@/components/status-pill";
import { ProductTabs } from "./product-tabs";

export default async function ProductTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("products.tabs");
  const tRoot = await getTranslations();

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, status, images")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const base = `/app/products/${id}`;
  const tabs = [
    { href: base, label: t("overview") },
    { href: `${base}/pricing`, label: t("pricing") },
    { href: `${base}/expenses`, label: t("expenses") },
    { href: `${base}/orders`, label: t("orders") },
    { href: `${base}/stock`, label: t("stock") },
    { href: `${base}/statistics`, label: t("statistics") },
    ...((await isCurrentUserAdmin()) ? [{ href: `${base}/selling`, label: t("selling") }] : []),
  ];
  const image = product.images?.[0] ?? null;

  return (
    <div className="space-y-6">
      {/* product-context header — shown across every tab */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/app/products" className="hover:text-foreground">
            {tRoot("products.title")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          <span className="text-foreground">{product.name}</span>
        </nav>
        <div className="flex items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external supplier URLs, no next/image domain config
            <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="h-12 w-12 shrink-0 rounded-lg bg-surface-raised" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{product.name}</h1>
            <div className="mt-1">
              <StatusPill kind="product" status={product.status} size="sm" />
            </div>
          </div>
        </div>
      </div>

      <ProductTabs tabs={tabs} />
      {children}
    </div>
  );
}
