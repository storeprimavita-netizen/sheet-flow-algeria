import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductView } from "@/components/store/product-view";
import { st } from "@/components/store/t";
import { getPublicProductPage, type PublicProductPage } from "@/lib/store/data";

// Covers trigger-driven stock; every mutation also calls updateTag("store-public").
export const revalidate = 120;

// Nothing is prebuilt: pages render on first visit, then are cached and tag-invalidated.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ store: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, slug } = await params;
  const dto = await getPublicProductPage(store, slug);
  if (!dto) return { title: st("notFound.title"), robots: { index: false, follow: false } };
  const { seo } = dto.page;
  const title = seo.title || dto.product.name || dto.page.title;
  const image = seo.image ?? dto.product.images[0];
  const hasSeo = Boolean(seo.title || seo.description || seo.image);
  return {
    title,
    description: seo.description,
    robots: hasSeo ? undefined : { index: false, follow: true },
    openGraph: { title, description: seo.description, images: image ? [image] : undefined, locale: "ar_DZ", type: "website" },
  };
}

function jsonLd(dto: PublicProductPage) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: dto.product.name,
    image: dto.product.images,
    offers: { "@type": "Offer", price: dto.product.price, priceCurrency: "DZD" },
  };
  // "<" escaped so the payload can never close the script tag
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function StoreProductPage({ params }: Props) {
  const { store, slug } = await params;
  const dto = await getPublicProductPage(store, slug);
  if (!dto) notFound();

  return (
    <>
      <ProductView dto={dto} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dto) }} />
    </>
  );
}
