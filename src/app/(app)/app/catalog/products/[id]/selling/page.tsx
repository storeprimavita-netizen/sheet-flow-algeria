import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { requireAdmin } from "@/lib/rbac";
import { loadProductVariants } from "@/lib/catalog/variants-data";
import { parseDeliveryMethods, parseFormFields } from "@/lib/store/form-fields";
import { createClient } from "@/lib/supabase/server";

import { FormEditor } from "./_components/form-editor";
import { OffersEditor, type OfferRow } from "./_components/offers-editor";
import { PricingEditor } from "./_components/pricing-editor";

/** Selling tab: how the product is priced, its quantity offers + bump, and its order-form fields. Admin only. */
export default async function ProductSellingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/app/orders"); // re-checked here, not only in the layout
  const { id } = await params;
  const t = await getTranslations("store.admin.selling");
  const supabase = await createClient();

  const [{ data: product }, variantMap, { data: values }, { data: overrides }, { data: offers }, { data: form }, { data: candidates }, { data: sized }, { data: pages }] =
    await Promise.all([
      supabase.from("products").select("sale_price, compare_at_price, pricing_mode").eq("id", id).maybeSingle(),
      loadProductVariants(supabase, [id]),
      supabase.from("product_option_values").select("id, price_delta").eq("product_id", id),
      supabase.from("product_variants").select("id, price_override, compare_at_override").eq("product_id", id),
      supabase.from("product_offers").select("*").eq("product_id", id).order("position"),
      supabase.from("product_forms").select("fields, delivery_methods").eq("product_id", id).maybeSingle(),
      supabase.from("products").select("id, name, sale_price").eq("is_active", true).not("sale_price", "is", null).neq("id", id).order("name").limit(200),
      supabase.from("product_variants").select("product_id"),
      supabase.from("store_pages").select("slug, stores!inner(slug, status)").eq("product_id", id).eq("status", "published").limit(1),
    ]);
  if (!product) notFound();

  const pv = variantMap.get(id);
  const delta = new Map((values ?? []).map((v) => [v.id, v.price_delta]));
  const over = new Map((overrides ?? []).map((v) => [v.id, v]));
  const sizedIds = new Set((sized ?? []).map((s) => s.product_id));
  const bumpCandidates = (candidates ?? []).filter((c) => !sizedIds.has(c.id)).map((c) => ({ id: c.id, name: c.name, price: Math.round(Number(c.sale_price)) }));

  const live = pages?.find((p) => p.stores?.status === "live");
  const storeUrl = live?.stores ? `/s/${live.stores.slug}/${live.slug}` : null;

  const quantity: OfferRow[] = (offers ?? [])
    .filter((o) => o.kind === "quantity" && o.qty !== null && o.total_price !== null)
    .map((o) => ({ id: o.id, label: o.label, qty: o.qty!, total: o.total_price!, isDefault: o.is_default, isActive: o.is_active, activeFrom: o.active_from, activeTo: o.active_to }));
  const bumpRow = (offers ?? []).find((o) => o.kind === "bump");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("purpose")}</p>
        </div>
        {storeUrl ? (
          <ButtonLink href={storeUrl} variant="outline" size="sm">
            <ExternalLink />
            {t("viewOnStore")}
          </ButtonLink>
        ) : (
          <p className="text-xs text-muted-foreground">{t("viewOnStoreNone")}</p>
        )}
      </div>

      <PricingEditor
        productId={id}
        salePrice={product.sale_price === null ? null : Math.round(Number(product.sale_price))}
        mode={product.pricing_mode as "uniform" | "per_value" | "per_variant"}
        compareAt={product.compare_at_price === null ? null : Math.round(Number(product.compare_at_price))}
        options={(pv?.options ?? []).map((o) => ({ id: o.id, name: o.name, values: o.values.map((v) => ({ id: v.id, label: v.label, delta: delta.get(v.id) ?? 0 })) }))}
        variants={(pv?.variants ?? []).map((v) => ({
          id: v.id,
          label: v.label,
          valueIds: Object.values(v.values),
          override: over.get(v.id)?.price_override ?? null,
          compareOverride: over.get(v.id)?.compare_at_override ?? null,
        }))}
      />

      <OffersEditor
        productId={id}
        salePrice={product.sale_price === null ? null : Math.round(Number(product.sale_price))}
        offers={quantity}
        bump={bumpRow ? { productId: bumpRow.bump_product_id, price: bumpRow.bump_price ?? 0, label: bumpRow.label, isActive: bumpRow.is_active } : null}
        candidates={bumpCandidates}
      />

      <FormEditor productId={id} fields={parseFormFields(form?.fields ?? null)} deliveryMethods={parseDeliveryMethods(form?.delivery_methods ?? null)} />
    </div>
  );
}
