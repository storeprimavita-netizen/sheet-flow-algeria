import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { tableClass } from "@/components/field";
import { createClient } from "@/lib/supabase/server";

import { CreatePageForm } from "../_components/create-page-form";
import { Crumbs } from "../_components/crumbs";
import { getStore } from "../_lib/data";

export default async function StorePagesPage() {
  const t = await getTranslations("store.admin");
  const store = await getStore();
  const head = (
    <div>
      <Crumbs items={[{ label: t("pages.title") }]} />
      <PageHeader title={t("pages.title")} subtitle={t("pages.purpose")} />
    </div>
  );

  if (!store) {
    return (
      <div className="space-y-6">
        {head}
        <Empty>
          <p className="mb-3">{t("pages.emptyNoStore")}</p>
          <ButtonLink href="/app/store">{t("pages.goHub")}</ButtonLink>
        </Empty>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: pages }, { data: products }] = await Promise.all([
    supabase.from("store_pages").select("id, title, slug, status, product_id").eq("store_id", store.id).order("created_at", { ascending: false }),
    supabase.from("products").select("id, name").order("name"),
  ]);
  const byId = new Map((products ?? []).map((p) => [p.id, p.name]));
  const used = new Set((pages ?? []).map((p) => p.product_id).filter(Boolean));
  const free = (products ?? []).filter((p) => !used.has(p.id));

  return (
    <div className="space-y-6">
      {head}
      {(products ?? []).length === 0 ? (
        <Empty>
          <p className="mb-3">{t("pages.emptyNoProducts")}</p>
          <ButtonLink href="/app/products/new">{t("pages.goProducts")}</ButtonLink>
        </Empty>
      ) : free.length > 0 ? (
        <CreatePageForm storeId={store.id} products={free} />
      ) : null}

      {(pages ?? []).length === 0 ? (
        (products ?? []).length > 0 ? <Empty>{t("pages.empty")}</Empty> : null
      ) : (
        <div className="card-surface overflow-x-auto rounded-xl">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("pages.colTitle")}</th>
                <th>{t("pages.colAddress")}</th>
                <th>{t("pages.colProduct")}</th>
                <th>{t("pages.colStatus")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(pages ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/app/store/pages/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="num" dir="ltr">
                    /s/{store.slug}/{p.slug}
                  </td>
                  <td>{p.product_id ? (byId.get(p.product_id) ?? "—") : <span className="text-muted-foreground">{t("pages.notLinked")}</span>}</td>
                  <td>
                    <StatusPill kind="store" status={p.status} />
                  </td>
                  <td className="text-end">
                    <ButtonLink href={`/app/store/pages/${p.id}`} variant="outline" size="sm">
                      {t("pages.open")}
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
