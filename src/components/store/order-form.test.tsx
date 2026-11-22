import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { defaultFormFields } from "@/lib/store/form-fields";
import { WILAYAS } from "@/lib/store/wilayas";
import type { PublicProductPage } from "@/lib/store/data";

import { OrderForm } from "./order-form";
import { orderFormStrings } from "./order-form-strings";
import { ProductView } from "./product-view";

const strings = orderFormStrings();
const redSwatch = "#ff0000"; // gate-allow-color: fixture for merchant-provided swatch data
const form = (extra: Partial<Parameters<typeof OrderForm>[0]> = {}) =>
  renderToStaticMarkup(
    <OrderForm
      action="/s/x/y/order"
      strings={strings}
      variants={[]}
      basePrice={5000}
      offers={[]}
      bump={null}
      fields={defaultFormFields().filter((f) => f.enabled)}
      deliveryMethods={["home", "stopdesk"]}
      wilayas={WILAYAS}
      pricingMode="uniform"
      {...extra}
    />,
  );

describe("order form markup", () => {
  test("form method is post, never GET; phone and select attributes", () => {
    const html = form();
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).not.toMatch(/method="get"/i);
    expect(html).toMatch(/type="tel"[^>]*/);
    expect(html.toLowerCase()).toContain('autocomplete="tel"');
    expect(html.toLowerCase()).toContain('inputmode="tel"');
    expect(html).toContain("<select");
    expect(html).toContain("16 - الجزائر");
  });
  test("several sizes: none preselected; one size: preselected", () => {
    const v = (id: string) => ({ id, label: id, inStock: true, price: 5000, compareAt: null });
    expect(form({ variants: [v("M"), v("L")] })).not.toMatch(/checked/);
    expect(form({ variants: [v("M")] })).toMatch(/checked/);
  });
  test("per_value shows +delta pills", () => {
    const v = (id: string, price: number) => ({ id, label: id, inStock: true, price, compareAt: null });
    expect(form({ pricingMode: "per_value", variants: [v("M", 5000), v("XL", 5300)] })).toContain("store-size-delta");
  });
  test("colour radios render text, colour and photo swatches with accessible names and stock state", () => {
    const html = form({
      variants: [
        { id: "red-m", label: "M / Red", inStock: true, price: 5000, compareAt: null, color: { key: 0, label: "Red", swatch: { color: redSwatch, image: null }, remainingLabel: "M" } },
        { id: "floral-m", label: "M / Floral", inStock: true, price: 5000, compareAt: null, color: { key: 1, label: "Floral", swatch: { color: null, image: "https://cdn.example.com/f.jpg" }, remainingLabel: "M" } },
        { id: "black-m", label: "M / Black", inStock: false, price: 5000, compareAt: null, color: { key: 2, label: "Black", swatch: null, remainingLabel: "M" } },
      ],
    });
    expect(html).toContain(`<legend class="store-label">${strings.colorLabel}</legend>`);
    expect(html).toContain(`style="--swatch:${redSwatch}"></span><bdi>Red</bdi>`);
    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn\.example\.com\/f\.jpg"[^>]*alt=""[^>]*loading="lazy"[^>]*\/><bdi>Floral<\/bdi>/);
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*name="color_0"[^>]*>[^<]*<span[^>]*><bdi>Black<\/bdi>/);
    expect(html).toContain(strings.outOfStock);
    expect(html).not.toContain('name="variant_0"');
  });
  test("a sole available colour-only variant supplies the exact variant on its own", () => {
    expect(form({
      variants: [{ id: "red-variant", label: "Red", inStock: true, price: 5000, compareAt: null, color: { key: 0, label: "Red", swatch: null, remainingLabel: null } }],
    })).toMatch(/<input type="hidden" name="variant_0" value="red-variant"\/>/);
  });
});

describe("public page has no live submit", () => {
  const dto: PublicProductPage = {
    store: { slug: "s", name: "S", theme: "luxe-modesty", settings: {} },
    page: { slug: "p", title: "P", blocks: [], seo: {} },
    product: { name: "P", price: 5000, compareAt: null, pricingMode: "uniform", priceFrom: false, images: [] },
    variants: [],
    options: [],
    offers: [],
    bump: null,
    form: { fields: [], deliveryMethods: ["home"] },
    reviews: { avg: 0, count: 0, items: [] },
    related: [],
  };
  test("no button, no form, honest state", () => {
    const html = renderToStaticMarkup(<ProductView dto={dto} />);
    expect(html).not.toMatch(/<button|type="submit"|<form/);
    expect(html).toContain("store-soon");
  });

  test("every size out of stock: sold-out state, no order form or offers", () => {
    const v = (id: string) => ({ id, label: id, inStock: false, price: 5000, compareAt: null });
    const out = { ...dto, variants: [v("M"), v("L")], offers: [{ id: "o", label: "x2", qty: 2, total: 9000, saving: 1000 }] } as PublicProductPage;
    const html = renderToStaticMarkup(<ProductView dto={out} orderSlot={<form id="f" />} />);
    expect(html).toContain("نفدت الكمية");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("store-offers-info");
    expect(html).not.toContain("الطلب سيُفتح قريبًا");
  });
});
