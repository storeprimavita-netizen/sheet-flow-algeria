import { BadgeCheck, Star } from "lucide-react";

import type { Block } from "@/lib/store/blocks";
import { SIZEGUIDE_COLUMNS } from "@/lib/store/blocks";
import type { PublicReview, PublicReviews } from "@/lib/store/data";

import { st, type StoreKey } from "./t";

type SizeguideBlock = Extract<Block, { type: "sizeguide" }>;

const PLURAL_KEYS: Record<Intl.LDMLPluralRule, StoreKey> = {
  zero: "reviews.countZero",
  one: "reviews.countOne",
  two: "reviews.countTwo",
  few: "reviews.countFew",
  many: "reviews.countMany",
  other: "reviews.countOther",
};
const plural = new Intl.PluralRules("ar");
export const reviewCountLabel = (n: number) => st(PLURAL_KEYS[plural.select(n)], { n });

// Western digits, UTC: the same date for every visitor and for the server render
const dateFmt = new Intl.DateTimeFormat("ar-DZ-u-nu-latn", { dateStyle: "medium", timeZone: "UTC" });

/** Decorative stars plus one text alternative; the digits carry the meaning for everyone else. */
export function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="store-stars">
      <span aria-hidden="true" className="store-stars-icons">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={16} strokeWidth={1.5} data-on={i <= rounded} />
        ))}
      </span>
      <span className="store-sr">{st("reviews.stars", { n: value })}</span>
    </span>
  );
}

/** Rating line under the title; only rendered when the page has a reviews block and at least one approved review. */
export function RatingLine({ reviews }: { reviews: PublicReviews }) {
  return (
    <a className="store-rating" href="#reviews">
      <Stars value={reviews.avg} />
      <span className="store-rating-num" aria-hidden="true">
        <bdi>{reviews.avg}</bdi>
      </span>
      <span>{reviewCountLabel(reviews.count)}</span>
    </a>
  );
}

export function SizeguideSection({ block }: { block: SizeguideBlock }) {
  const cols = SIZEGUIDE_COLUMNS.filter((c) => block.rows.some((r) => r[c]));
  const title = block.title ?? st("sizeguide.title");
  return (
    <section className="store-section store-sizeguide">
      <h2>{title}</h2>
      <div className="store-table-wrap" role="region" aria-label={st("sizeguide.region")} tabIndex={0}>
        <table>
          <caption className="store-sr">{title}</caption>
          <thead>
            <tr>
              <th scope="col">{st("sizeguide.size")}</th>
              {cols.map((c) => (
                <th key={c} scope="col">
                  {st(`sizeguide.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">
                  <bdi>{r.size}</bdi>
                </th>
                {cols.map((c) => (
                  <td key={c}>{r[c] ? <bdi>{r[c]}</bdi> : null}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.note ? <p className="store-note">{block.note}</p> : null}
    </section>
  );
}

function ReviewCard({ r }: { r: PublicReview }) {
  return (
    <li className="store-review">
      <div className="store-review-head">
        <Stars value={r.rating} />
        <span className="store-review-name">{r.name ? <bdi>{r.name}</bdi> : st("reviews.anonymous")}</span>
      </div>
      <p className="store-review-body" dir="auto">{r.text}</p>
      <div className="store-review-foot">
        {r.verified ? (
          <span className="store-verified">
            <BadgeCheck size={16} strokeWidth={1.5} aria-hidden="true" />
            {st("reviews.verified")}
          </span>
        ) : null}
        <time dateTime={r.date}>{dateFmt.format(new Date(r.date))}</time>
      </div>
    </li>
  );
}

const FIRST = 6;

export function ReviewsSection({ reviews }: { reviews: PublicReviews }) {
  if (reviews.items.length === 0) return null;
  const head = reviews.items.slice(0, FIRST);
  const rest = reviews.items.slice(FIRST);
  return (
    <section className="store-section store-reviews" id="reviews">
      <h2>{st("reviews.title")}</h2>
      <p className="store-reviews-sum">
        <Stars value={reviews.avg} />
        <bdi>{reviews.avg}</bdi> · {reviewCountLabel(reviews.count)}
      </p>
      <ul className="store-reviews-grid">
        {head.map((r, i) => (
          <ReviewCard key={i} r={r} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="store-more">
          <summary>{st("reviews.more", { n: rest.length })}</summary>
          <ul className="store-reviews-grid">
            {rest.map((r, i) => (
              <ReviewCard key={i} r={r} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
