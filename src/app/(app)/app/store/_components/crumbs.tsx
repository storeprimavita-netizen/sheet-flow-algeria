import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Group > Page > Record, each part a link except the last. */
export async function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  const t = await getTranslations("store.admin");
  const all = [{ label: t("breadcrumbRoot"), href: "/app/store" }, ...items];
  return (
    <nav aria-label="breadcrumb" className="mb-2 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" /> : null}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className="hover:text-foreground hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === all.length - 1 ? "page" : undefined} className={i === all.length - 1 ? "text-foreground" : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
