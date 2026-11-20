import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { PublicProductPage } from "@/lib/store/data";

import { ProductView } from "./product-view";
import { ReviewsSection, SizeguideSection } from "./review-blocks";

const rev = { avg: 4.5, count: 1, items: [{ name: "Amina B.", rating: 5, text: "Belle", date: "2026-01-02T00:00:00Z", verified: false }] };
const dto = (blocks: PublicProductPage["page"]["blocks"], reviews: PublicProductPage["reviews"]): PublicProductPage => ({
  store: { slug: "s", name: "Luxe", theme: {}, settings: {} },
  page: { slug: "p", title: "P", blocks, seo: {} },
  product: { name: "Abaya", price: 100, images: [] },
  variants: [],
  related: [],
  reviews,
} as unknown as PublicProductPage);

describe("SizeguideSection", () => {
  test("hides columns that are empty in every row", () => {
    const html = renderToStaticMarkup(
      <SizeguideSection block={{ type: "sizeguide", rows: [{ size: "M", chest: "90" }, { size: "L", chest: "95" }] } as never} />,
    );
    expect(html.match(/<th scope="col"/g)).toHaveLength(2); // size + chest only
    expect(html).toContain("90");
  });
});

describe("bidi", () => {
  test("the size note and a review body both get dir=auto", () => {
    const sg = renderToStaticMarkup(<SizeguideSection block={{ type: "sizeguide", rows: [{ size: "M", chest: "90" }], note: "Mesures en cm" } as never} />);
    expect(sg).toContain('<p class="store-note" dir="auto">Mesures en cm</p>');
    const rv = renderToStaticMarkup(<ReviewsSection reviews={{ ...rev, items: [{ ...rev.items[0], text: "Very nice" }] }} />);
    expect(rv).toContain('dir="auto">Very nice</p>');
  });
});

describe("reviews rendering", () => {
  test("a reviews block with 0 approved renders nothing", () => {
    expect(renderToStaticMarkup(<ReviewsSection reviews={{ avg: 0, count: 0, items: [] }} />)).toBe("");
    const html = renderToStaticMarkup(<ProductView dto={dto([{ type: "reviews" }], { avg: 0, count: 0, items: [] })} />);
    expect(html).not.toContain('id="reviews"');
    expect(html).not.toContain('href="#reviews"');
  });
  test("no reviews block renders neither the section nor the rating line", () => {
    const html = renderToStaticMarkup(<ProductView dto={dto([], rev)} />);
    expect(html).not.toContain('id="reviews"');
    expect(html).not.toContain('href="#reviews"');
  });
  test("with a block and an approved review both render", () => {
    const html = renderToStaticMarkup(<ProductView dto={dto([{ type: "reviews" }], rev)} />);
    expect(html).toContain('id="reviews"');
    expect(html).toContain('href="#reviews"');
  });
});
