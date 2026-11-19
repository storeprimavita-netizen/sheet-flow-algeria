import Link from "next/link";
import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

import { Crumbs } from "../_components/crumbs";
import { getStore } from "../_lib/data";
import { ReviewFilters, type ReviewStatusFilter } from "./_components/review-filters";
import { ReviewForm } from "./_components/review-form";
import { ReviewRowActions } from "./_components/review-row-actions";

const LIMIT = 100;
const filterSchema = z.object({
  product: z.uuid().optional().catch(undefined),
  status: z.enum(["approved", "hidden"]).optional().catch(undefined),
});

export default async function StoreReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("store.admin.reviews");
  const tr = await getTranslations("store.admin");
  const store = await getStore(); // also the route guard: agents get a 404
  const raw = await searchParams;
  const f = filterSchema.parse({ product: typeof raw.product === "string" ? raw.product : undefined, status: typeof raw.status === "string" ? raw.status : undefined });
  const status: ReviewStatusFilter = f.status ?? "all";
  const head = (
    <div>
      <Crumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} subtitle={t("purpose")} />
    </div>
  );

  if (!store) {
    return (
      <div className="space-y-6">
        {head}
        <Empty>
          <p className="mb-3">{tr("pages.emptyNoStore")}</p>
          <ButtonLink href="/app/store">{tr("pages.goHub")}</ButtonLink>
        </Empty>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: pages, error: pagesErr } = await supabase.from("store_pages").select("product_id").eq("store_id", store.id).not("product_id", "is", null);
  if (pagesErr) throw new Error(pagesErr.message);
  const productIds = [...new Set((pages ?? []).flatMap((p) => (p.product_id ? [p.product_id] : [])))];
  if (productIds.length === 0) {
    return (
      <div className="space-y-6">
        {head}
        <Empty>
          <p className="mb-3">{t("emptyNoPages")}</p>
          <ButtonLink href="/app/store/pages">{t("goPages")}</ButtonLink>
        </Empty>
      </div>
    );
  }

  let q = supabase
    .from("reviews")
    .select("id, product_id, name, rating, body, approved, order_id, created_at")
    .in("product_id", productIds)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (f.product) q = q.eq("product_id", f.product);
  if (f.status) q = q.eq("approved", f.status === "approved");
  const [{ data: products, error: prodErr }, { data: reviews, error: revErr }] = await Promise.all([
    supabase.from("products").select("id, name").in("id", productIds).order("name"),
    q,
  ]);
  if (prodErr) throw new Error(prodErr.message);
  if (revErr) throw new Error(revErr.message);
  const names = new Map((products ?? []).map((p) => [p.id, p.name]));
  const orderIds = [...new Set((reviews ?? []).flatMap((r) => (r.order_id ? [r.order_id] : [])))];
  const orders = new Map<string, number>();
  if (orderIds.length) {
    const { data } = await supabase.from("orders").select("id, order_seq").in("id", orderIds);
    for (const o of data ?? []) orders.set(o.id, o.order_seq);
  }
  const filtered = !!(f.product || f.status);

  return (
    <div className="space-y-6">
      {head}
      <ReviewForm products={(products ?? []).map((p) => ({ id: p.id, name: p.name }))} />
      <ReviewFilters products={(products ?? []).map((p) => ({ id: p.id, name: p.name }))} product={f.product ?? ""} status={status} />

      {(reviews ?? []).length === 0 ? (
        <Empty>
          <p className="mb-3">{filtered ? t("emptyNoMatch") : t("emptyNone")}</p>
          {filtered ? <ButtonLink href="/app/store/reviews" variant="outline">{t("clear")}</ButtonLink> : null}
        </Empty>
      ) : (
        <div className="card-surface overflow-x-auto rounded-xl">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("colReview")}</th>
                <th>{t("colProduct")}</th>
                <th>{t("colOrder")}</th>
                <th>{t("colStatus")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(reviews ?? []).map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1" aria-label={t("rated", { n: r.rating })} role="img">
                        <Star className="h-4 w-4 fill-current text-warning" aria-hidden="true" />
                        <span className="num font-medium" aria-hidden="true">{r.rating}</span>
                      </span>
                      <span className="font-medium">{r.name}</span>
                    </div>
                    <p className="mt-1 break-words text-muted-foreground">{r.body}</p>
                  </td>
                  <td>
                    <Link href={`/app/products/${r.product_id}`} className="hover:underline">
                      {names.get(r.product_id) ?? "—"}
                    </Link>
                  </td>
                  <td>
                    {r.order_id && orders.has(r.order_id) ? (
                      <Link href={`/app/orders/${r.order_id}`} className="num hover:underline">
                        {t("orderLink", { n: orders.get(r.order_id)! })}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t("noOrder")}</span>
                    )}
                  </td>
                  <td>
                    <StatusPill kind="review" status={r.approved ? "approved" : "hidden"} />
                  </td>
                  <td>
                    <ReviewRowActions id={r.id} name={r.name} approved={r.approved} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(reviews ?? []).length >= LIMIT ? <p className="text-xs text-muted-foreground">{t("capped", { n: LIMIT })}</p> : null}
    </div>
  );
}
