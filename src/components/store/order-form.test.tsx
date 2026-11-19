import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { defaultFormFields } from "@/lib/store/form-fields";
import { WILAYAS } from "@/lib/store/wilayas";
import type { PublicProductPage } from "@/lib/store/data";

import { OrderForm } from "./order-form";
import { orderFormStrings } from "./order-form-strings";
import { ProductView } from "./product-view";

const strings = orderFormStrings();
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
});

describe("public page has no live submit", () => {
  const dto: PublicProductPage = {
    store: { slug: "s", name: "S", theme: "luxe-modesty", settings: {} },
    page: { slug: "p", title: "P", blocks: [], seo: {} },
    product: { name: "P", price: 5000, compareAt: null, pricingMode: "uniform", priceFrom: false, images: [] },
    variants: [],
    offers: [],
    bump: null,
    form: { fields: [], deliveryMethods: ["home"] },
    related: [],
  };
  test("no button, no form, honest state", () => {
    const html = renderToStaticMarkup(<ProductView dto={dto} />);
    expect(html).not.toMatch(/<button|type="submit"|<form/);
    expect(html).toContain("store-soon");
  });
});
