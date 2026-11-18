import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StoreShell } from "@/components/store/chrome";
import { st } from "@/components/store/t";
import { formatCurrency } from "@/lib/format";
import type { Block } from "@/lib/store/blocks";
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

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "text":
      return <p>{block.text}</p>;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- plain img by design (no remote image optimizer)
      return <img src={block.url} alt={block.alt} width={800} height={1000} loading="lazy" decoding="async" />;
    case "list":
      return (
        <ul>
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export default async function StoreProductPage({ params }: Props) {
  const { store, slug } = await params;
  const dto = await getPublicProductPage(store, slug);
  if (!dto) notFound();
  const unit = st("currency");

  return (
    <StoreShell store={dto.store}>
      <nav className="store-crumbs" aria-label="breadcrumb">
        <ol>
          <li><bdi>{dto.store.name}</bdi></li>
          <li aria-current="page">{dto.product.name}</li>
        </ol>
      </nav>

      <div className="store-top">
        <div className="store-gallery" role="group" aria-label={dto.product.name}>
          {dto.product.images.length === 0 ? (
            <div className="store-photo-empty">{st("noPhoto")}</div>
          ) : (
            dto.product.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- plain img by design
              <img
                key={src}
                className="store-photo"
                src={src}
                alt={st("galleryAlt", { n: i + 1, total: dto.product.images.length })}
                title={dto.product.name}
                width={800}
                height={1000}
                {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
                decoding={i === 0 ? "sync" : "async"}
              />
            ))
          )}
        </div>

        <div className="store-buy">
          <h1 className="store-title">{dto.product.name}</h1>
          <hr className="store-rule" />
          <p className="store-price store-price-row">{formatCurrency(dto.product.price, unit)}</p>
          {dto.variants.length > 0 ? (
            <div>
              <p className="store-label">{st("sizes")}</p>
              <ul className="store-sizes">
                {dto.variants.map((v) => (
                  <li key={v.label} className="store-size" data-out={!v.inStock}>
                    <bdi>{v.label}</bdi>
                    {v.inStock ? null : <span className="sr-only">{st("outOfStock")}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* order form slot (STORE-3) */}
          <div id="order" hidden />
        </div>
      </div>

      {dto.page.blocks.some((b) => b.type !== "related") ? (
        <section className="store-blocks">
          {dto.page.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </section>
      ) : null}

      {dto.related.length > 0 ? (
        <section className="store-related">
          <h2>{st("related")}</h2>
          <ul className="store-grid">
            {dto.related.map((r) => (
              <li key={r.slug}>
                <Link className="store-card" href={`/s/${dto.store.slug}/${r.slug}`}>
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- plain img by design
                    <img className="store-photo" src={r.image} alt="" width={400} height={500} loading="lazy" decoding="async" />
                  ) : (
                    <div className="store-photo-empty" aria-hidden="true" />
                  )}
                  <span>{r.title}</span>
                  <span className="store-price">{formatCurrency(r.price, unit)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dto) }} />
    </StoreShell>
  );
}
