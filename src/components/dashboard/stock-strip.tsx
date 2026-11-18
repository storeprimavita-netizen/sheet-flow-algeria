import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Boxes, PackageX, Lock, Truck } from "lucide-react";

import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Band, BandError } from "./band";

export type StockRow = {
  productId: string;
  name: string;
  inStock: number;
  reserved: number;
  onRoad: number;
  delivered: number;
  low: boolean;
};

const MAX_ROWS = 6;

/**
 * Band 5 — In stock / Reserved / On road / Low-stock items totals, then one row per product with
 * In stock, Reserved, On road and Delivered (all from `product_stock_v`; low = D34 rule, in SQL).
 * Low products first. Totals are plain sums of the SQL columns.
 */
export async function StockStrip({ rows }: { rows: StockRow[] | null }) {
  const t = await getTranslations("dashboard.v2.stock");
  const sum = (pick: (r: StockRow) => number) => (rows ?? []).reduce((n, r) => n + pick(r), 0);
  const lowCount = (rows ?? []).filter((r) => r.low).length;
  return (
    <Band id="band-stock" title={t("title")}>
      {!rows ? (
        <BandError />
      ) : rows.length === 0 ? (
        <Empty className="space-y-3 p-6">
          <p>{t("empty")}</p>
          <ButtonLink href="/app/products/new" variant="outline">
            {t("add")}
          </ButtonLink>
        </Empty>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile icon={Boxes} label={t("inStock")} value={String(sum((r) => r.inStock))} href="/app/stock" />
            <KpiTile icon={Lock} label={t("reserved")} value={String(sum((r) => r.reserved))} hint={t("reservedHint")} href="/app/stock" />
            <KpiTile icon={Truck} label={t("onRoad")} value={String(sum((r) => r.onRoad))} hint={t("onRoadHint")} href="/app/orders/delivery" />
            <KpiTile
              icon={PackageX}
              label={t("lowItems")}
              value={String(lowCount)}
              tone={lowCount > 0 ? "danger" : undefined}
              hint={t("lowItemsHint")}
              href="/app/stock"
            />
          </div>
          <div className="card-surface divide-y divide-border rounded-xl">
            {rows.slice(0, MAX_ROWS).map((r) => (
              <Link
                key={r.productId}
                href={`/app/products/${r.productId}/stock`}
                className="flex flex-col gap-1.5 px-4 py-2.5 text-sm hover:bg-surface-raised/40 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  {r.low ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">
                      <PackageX className="h-3 w-3" />
                      {t("low")}
                    </span>
                  ) : null}
                </span>
                <span className="grid grid-cols-4 gap-3 text-xs text-muted-foreground sm:w-80 sm:shrink-0">
                  {(
                    [
                      ["inStock", r.inStock],
                      ["reserved", r.reserved],
                      ["onRoad", r.onRoad],
                      ["delivered", r.delivered],
                    ] as const
                  ).map(([k, v]) => (
                    <span key={k} className="flex flex-col">
                      <span className="truncate">{t(k)}</span>
                      <span className="num text-sm font-medium text-foreground">{v}</span>
                    </span>
                  ))}
                </span>
              </Link>
            ))}
            {rows.length > MAX_ROWS ? (
              <Link href="/app/stock" className="block px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
                {t("viewAll", { n: rows.length })}
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </Band>
  );
}
