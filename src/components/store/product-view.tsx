import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import type { Block } from "@/lib/store/blocks";
import type { PublicProductPage } from "@/lib/store/data";

import { StoreShell } from "./chrome";
import { st } from "./t";

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

/** The product page body. Used by the public route and by the admin preview, so both render the same thing. */
export function ProductView({ dto }: { dto: PublicProductPage }) {
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
                      {v.inStock ? null : <span className="store-sr">{st("outOfStock")}</span>}
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
      </StoreShell>
  );
}
