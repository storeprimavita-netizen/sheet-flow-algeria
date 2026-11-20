import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { LEGACY_REDIRECTS } from "./legacy-redirects";

function toRegex(source: string): RegExp {
  const body = source
    .replace(/\/:\w+\*/g, "(?:/.*)?")
    .replace(/:\w+/g, "[^/]+");
  return new RegExp(`^${body}$`);
}

describe("next.config redirects", () => {
  it("every old URL maps to a canonical one, permanent", async () => {
    const rules = await (nextConfig as { redirects?: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects!();
    expect(rules.length).toBe(LEGACY_REDIRECTS.length);
    for (const r of rules) {
      expect(r.permanent).toBe(true);
      expect(r.source).toMatch(/^\/app\/(orders|contacts|products|stock|pricing|finance)/);
      expect(r.destination).toMatch(/^\/app\/(sell|catalog|money)/);
    }
  });

  it("no redirect chain (destination never matches another source)", () => {
    for (const r of LEGACY_REDIRECTS) {
      const path = r.destination.split("?")[0].replace(/:path\*/, "x").replace(/:id/, "1");
      for (const other of LEGACY_REDIRECTS) {
        expect(toRegex(other.source).test(path), `${r.destination} matches ${other.source}`).toBe(false);
      }
    }
  });

  it("dynamic ids and suppliers/new covered", () => {
    const hit = (p: string) => LEGACY_REDIRECTS.find((r) => toRegex(r.source).test(p));
    expect(hit("/app/orders/abc")?.destination).toBe("/app/sell/orders/:id");
    expect(hit("/app/contacts/abc")?.destination).toBe("/app/sell/customers/:id");
    expect(hit("/app/contacts/suppliers/new")?.destination).toBe("/app/money/suppliers/:path*");
    expect(hit("/app/products/abc/stock")?.destination).toBe("/app/catalog/products/:path*");
    expect(hit("/app/products/new")?.destination).toBe("/app/catalog/products/:path*");
  });
});
