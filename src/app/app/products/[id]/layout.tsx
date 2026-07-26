import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

export default async function ProductTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("products.tabs");

  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
  if (!product) notFound();

  const base = `/app/products/${id}`;
  const tabs = [
    { href: base, label: t("details") },
    { href: `${base}/expenses`, label: t("expenses") },
    { href: `${base}/stock`, label: t("stock") },
    { href: `${base}/statistics`, label: t("statistics") },
    { href: `${base}/pricing`, label: t("pricing") },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-border text-sm">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="px-3 py-2 text-muted-foreground hover:text-foreground">
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
