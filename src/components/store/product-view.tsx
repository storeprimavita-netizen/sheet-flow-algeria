import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import type { Block } from "@/lib/store/blocks";
import type { PublicProductPage } from "@/lib/store/data";

import { StoreShell } from "./chrome";
import { Gallery } from "./gallery";
import { StorePhoto } from "./photo";
import { RatingLine, ReviewsSection, SizeguideSection } from "./review-blocks";
import { st } from "./t";

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "text":
      return <p>{block.text}</p>;
    case "image":
      return <StorePhoto src={block.url} alt={block.alt} emptyLabel={block.alt || undefined} width={800} height={1000} loading="lazy" decoding="async" />;
    case "list":
      return (
        <ul>
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    // full-width sections rendered outside .store-blocks (see ProductView)
    case "related":
    case "sizeguide":
    case "reviews":
      return null;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

const INLINE_BLOCKS = new Set<Block["type"]>(["heading", "text", "image", "list"]);

/** The product page body. Used by the public route and by the admin preview, so both render the same thing. */
export function ProductView({ dto, orderSlot }: { dto: PublicProductPage; orderSlot?: React.ReactNode }) {
  const unit = st("currency");
  const { price, compareAt } = dto.product;
  const pct = price !== null && compareAt !== null && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const soldOut = dto.variants.length > 0 && dto.variants.every((v) => !v.inStock);
  const hasReviews = dto.page.blocks.some((b) => b.type === "reviews");
  const sizeguide = dto.page.blocks.find((b) => b.type === "sizeguide");
  return (
    <StoreShell store={dto.store}>
        <nav className="store-crumbs" aria-label="breadcrumb">
          <ol>
            <li><bdi>{dto.store.name}</bdi></li>
            <li aria-current="page">{dto.product.name}</li>
          </ol>
        </nav>
  
        <div className="store-top">
          <Gallery name={dto.product.name} images={dto.product.images} />
  
          <div className="store-buy">
            <h1 className="store-title">{dto.product.name}</h1>
            {hasReviews && dto.reviews.count > 0 && dto.reviews.items.length > 0 ? <RatingLine reviews={dto.reviews} /> : null}
            <hr className="store-rule" />
            <p className="store-price store-price-row">
              {dto.product.priceFrom && price !== null ? st("order.startingFrom", { price: formatCurrency(price, unit) }) : formatCurrency(price, unit)}
              {compareAt !== null && pct > 0 ? (
                <>
                  {" "}
                  <s className="store-price-old">{formatCurrency(compareAt, unit)}</s>
                  {" "}
                  <span className="store-badge">{st("order.savePct", { pct })}</span>
                </>
              ) : null}
            </p>
            {!orderSlot && dto.variants.length > 0 ? (
              <div>
                <p className="store-label">{st("sizes")}</p>
                <ul className="store-sizes">
                  {dto.variants.map((v) => (
                    <li key={v.id} className="store-size" data-out={!v.inStock}>
                      <bdi>{v.label}</bdi>
                      {v.inStock ? null : <span className="store-sr">{st("outOfStock")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!orderSlot && !soldOut && dto.offers.length > 0 ? (
              <div>
                <p className="store-label">{st("order.offersInfoTitle")}</p>
                <ul className="store-offers-info">
                  {dto.offers.map((o) => (
                    <li key={o.id}>
                      <span>
                        {o.label}
                        <span className="store-offer-save"> {st("order.offerSave", { n: formatCurrency(o.saving, unit) })}</span>
                      </span>
                      <span className="store-price">{formatCurrency(o.total, unit)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {/* sizes and offers above are shown only while the order form is absent: the form has its own pickers */}
            {/* no live submit until STORE-4: an honest state, never a button that does nothing */}
            <div id="order">
              {soldOut ? (
                <section className="store-soon" aria-labelledby="order-soldout">
                  <h2 id="order-soldout">{st("order.soldOutTitle")}</h2>
                  <p className="store-form-lead">{st("order.soldOutBody")}</p>
                </section>
              ) : (
                (orderSlot ?? (
                  <section className="store-soon" aria-labelledby="order-soon">
                    <h2 id="order-soon">{st("order.soonTitle")}</h2>
                    <p className="store-form-lead">{st("order.soonBody")}</p>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
  
        {dto.page.blocks.some((b) => INLINE_BLOCKS.has(b.type)) ? (
          <section className="store-blocks">
            {dto.page.blocks.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </section>
        ) : null}
  
        {sizeguide ? <SizeguideSection block={sizeguide} /> : null}
        {hasReviews ? <ReviewsSection reviews={dto.reviews} /> : null}

        {dto.related.length > 0 ? (
          <section className="store-related">
            <h2>{st("related")}</h2>
            <ul className="store-grid">
              {dto.related.map((r) => (
                <li key={r.slug}>
                  <Link className="store-card" href={`/s/${dto.store.slug}/${r.slug}`}>
                    {r.image ? (
                      <StorePhoto className="store-photo" src={r.image} alt="" width={400} height={500} loading="lazy" decoding="async" />
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
