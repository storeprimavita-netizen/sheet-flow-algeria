import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { StorePhoto } from "./photo";

describe("StorePhoto server render", () => {
  test("renders the img (the pre-hydration state the mount effect then checks)", () => {
    const html = renderToStaticMarkup(<StorePhoto src="/x.jpg" alt="a" className="store-photo" emptyLabel="no photo" />);
    expect(html).toContain('<img');
    expect(html).toContain('class="store-photo"');
    expect(html).not.toContain("store-photo-empty");
  });
});
