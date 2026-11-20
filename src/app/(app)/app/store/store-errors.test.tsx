import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

type Result = { data: unknown; error: { message: string } | null };
let results: Record<string, Result>;

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("./_lib/data", () => ({ getStore: async () => ({ id: "s1", slug: "luxe", name: "Luxe", status: "live", settings: {} }), requireStoreAdmin: async () => ({}) }));
vi.mock("../_lib/data", () => ({ getStore: async () => ({ id: "s1", slug: "luxe", name: "Luxe", status: "live", settings: {} }), requireStoreAdmin: async () => ({}) }));
vi.mock("./_components/create-store-form", () => ({ CreateStoreForm: () => null }));
vi.mock("../_components/create-page-form", () => ({ CreatePageForm: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown) => ok(results[table]);
      return q;
    },
  }),
}));

import StoreHubPage from "./page";
import StorePagesPage from "./pages/page";
import StoreError from "./error";

describe("store admin read errors", () => {
  beforeEach(() => {
    results = {
      store_pages: { data: [], error: null },
      products: { data: [], error: null },
    };
  });
  test("hub throws on store_pages error", async () => {
    results.store_pages = { data: null, error: { message: "boom" } };
    await expect(StoreHubPage()).rejects.toThrow(/boom/);
  });
  test("pages list throws on store_pages or products error", async () => {
    results.store_pages = { data: null, error: { message: "pages-down" } };
    await expect(StorePagesPage()).rejects.toThrow(/pages-down/);
    results.store_pages = { data: [], error: null };
    results.products = { data: null, error: { message: "products-down" } };
    await expect(StorePagesPage()).rejects.toThrow(/products-down/);
  });
});

describe("store error.tsx", () => {
  for (const [l, messages] of [["en", en], ["ar", ar]] as const) {
    test(`error.tsx shows reason and retry (${l})`, () => {
      const html = renderToStaticMarkup(
        <NextIntlClientProvider locale={l} messages={messages}>
          <StoreError error={Object.assign(new Error("x"), { digest: "d1" })} unstable_retry={() => {}} />
        </NextIntlClientProvider>,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(messages.errorPage.body);
      expect(html).toContain(messages.errorPage.retry);
      expect(html).toContain("d1");
    });
  }
});
