import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PackageX } from "lucide-react";

import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { Band, BandError } from "./band";

export type StockRow = { productId: string; name: string; inStock: number; reserved: number; low: boolean };

const MAX_ROWS = 6;

/** Band 5 — stock per product from `product_stock_v` (low = D34 rule, computed in SQL). Low products first. */
export async function StockStrip({ rows, retryHref }: { rows: StockRow[] | null; retryHref: string }) {
  const t = await getTranslations("dashboard.v2.stock");
  return (
    <Band id="band-stock" title={t("title")}>
      {!rows ? (
        <BandError retryHref={retryHref} />
      ) : rows.length === 0 ? (
        <Empty className="space-y-3 p-6">
          <p>{t("empty")}</p>
          <ButtonLink href="/app/products/new" variant="outline">
            {t("add")}
          </ButtonLink>
        </Empty>
      ) : (
        <div className="card-surface divide-y divide-border rounded-xl">
          {rows.slice(0, MAX_ROWS).map((r) => (
            <Link
              key={r.productId}
              href={`/app/products/${r.productId}/stock`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-raised/40"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              {r.low ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">
                  <PackageX className="h-3 w-3" />
                  {t("low")}
                </span>
              ) : null}
              <span className="num text-muted-foreground">
                {t("inStock")} <span className="font-medium text-foreground">{r.inStock}</span>
              </span>
              <span className="num hidden text-muted-foreground sm:inline">
                {t("reserved")} <span className="font-medium text-foreground">{r.reserved}</span>
              </span>
            </Link>
          ))}
          {rows.length > MAX_ROWS ? (
            <Link href="/app/stock" className="block px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
              {t("viewAll", { n: rows.length })}
            </Link>
          ) : null}
        </div>
      )}
    </Band>
  );
}
