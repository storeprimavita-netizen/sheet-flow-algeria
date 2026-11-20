import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { StatusPill } from "@/components/status-pill";
import { Meta, showsSizeCell, SizeMeta, WilayaValue } from "./orders/[id]/order-meta";
import type { VariantResult } from "./products/actions";
import { VariantsEditor } from "./products/_components/variants-editor";
import { VariantsFeedback } from "./products/_components/variants-feedback";
import { StockLevelChip } from "./stock/stock-level-chip";

// the editor imports a server action and the router; neither runs in a static render
vi.mock("./products/actions", () => ({ saveVariantConfig: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const locales = { en, ar } as const;
const wrap = (locale: "en" | "ar", node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locales[locale]}>
      {node}
    </NextIntlClientProvider>,
  );

describe("named option accessible names", () => {
  const named = {
    en: { moveUp: "Move option Size up", moveDown: "Move option Size down", remove: "Remove option Size" },
    ar: { moveUp: "نقل الخيار Size للأعلى", moveDown: "نقل الخيار Size للأسفل", remove: "حذف الخيار Size" },
  };
  for (const l of ["en", "ar"] as const) {
    test(l, () => {
      const t = createTranslator({ locale: l, messages: locales[l], namespace: "variants" });
      expect(t("moveOptionUp", { name: "Size" })).toBe(named[l].moveUp);
      expect(t("moveOptionDown", { name: "Size" })).toBe(named[l].moveDown);
      expect(t("removeOption", { name: "Size" })).toBe(named[l].remove);
    });
  }
});

describe("unnamed option accessible names", () => {
  const names = {
    en: { moveUp: "Move Option 1 up", moveDown: "Move Option 1 down", remove: "Remove Option 1", add: "Add value to Option 1", value: "Value 2 of Option 1" },
    ar: { moveUp: "نقل الخيار رقم 1 للأعلى", moveDown: "نقل الخيار رقم 1 للأسفل", remove: "حذف الخيار رقم 1", add: "إضافة قيمة إلى الخيار رقم 1", value: "القيمة 2 من الخيار رقم 1" },
  };
  for (const l of ["en", "ar"] as const) {
    test(l, () => {
      const t = createTranslator({ locale: l, messages: locales[l], namespace: "variants" });
      const name = t("optionFallback", { n: 1 });
      expect(t("moveOptionUpUnnamed", { name })).toBe(names[l].moveUp);
      expect(t("moveOptionDownUnnamed", { name })).toBe(names[l].moveDown);
      expect(t("removeOptionUnnamed", { name })).toBe(names[l].remove);
      expect(t("addValue", { name })).toBe(names[l].add);
      expect(t("valueNumbered", { n: 2, option: name })).toBe(names[l].value);
    });
  }
});

describe("variants feedback", () => {
  for (const l of ["en", "ar"] as const) {
    test(`${l}: stale is a role=alert with the localized text`, () => {
      const html = wrap(l, <VariantsFeedback unsaved result={{ ok: false, code: "stale", error: "stale" } satisfies VariantResult} />);
      expect(html).toContain('role="alert"');
      const t = createTranslator({ locale: l, messages: locales[l], namespace: "variants" });
      expect(html).toContain(t("stale"));
      expect(html).not.toContain(t("unsavedHint"));
    });
    test(`${l}: unsaved hint shows only without a message`, () => {
      const t = createTranslator({ locale: l, messages: locales[l], namespace: "variants" });
      expect(wrap(l, <VariantsFeedback unsaved result={null} />)).toContain(t("unsavedHint"));
      expect(wrap(l, <VariantsFeedback unsaved={false} result={null} />)).toBe("");
    });
  }
});

describe("stock level chip (real component)", () => {
  const labels = {
    en: { out: en.stock.out, low: en.stock.low },
    ar: { out: ar.stock.out, low: ar.stock.low },
  };
  for (const l of ["en", "ar"] as const) {
    const chip = (stock: number, isOut: boolean, isLow: boolean) => renderToStaticMarkup(<StockLevelChip stock={stock} isOut={isOut} isLow={isLow} labels={labels[l]} />);
    test(`${l}: out, low, ok; never wraps`, () => {
      expect(chip(0, true, false)).toContain(`0</span> · <bdi>${labels[l].out}</bdi>`);
      expect(chip(3, false, true)).toContain(`3</span> · <bdi>${labels[l].low}</bdi>`);
      const ok = chip(40, false, false);
      expect(ok).not.toContain("·");
      for (const html of [chip(0, true, false), chip(3, false, true), ok]) expect(html).toContain("whitespace-nowrap");
    });
  }
  test("Count needed pill renders its label", () => {
    expect(wrap("en", <StatusPill kind="stock" status="count_needed" size="sm" />)).toMatch(/Count needed/i);
  });
});

describe("order page cells", () => {
  test("showsSizeCell: admin with sizes false, agent true, admin without sizes keeps legacy text, no variant false", () => {
    expect(showsSizeCell(true, 2, "M / Red")).toBe(false);
    expect(showsSizeCell(false, 2, "M / Red")).toBe(true);
    expect(showsSizeCell(true, 0, "legacy")).toBe(true);
    expect(showsSizeCell(true, 2, null)).toBe(false);
    expect(showsSizeCell(false, 0, null)).toBe(false);
  });
  test("size cell renders once with an isolated value", () => {
    const html = renderToStaticMarkup(<SizeMeta label="Size" size="M / Red" />);
    expect(html.match(/>Size</g)).toHaveLength(1);
    expect(html).toContain("<bdi>M / Red</bdi>");
    expect(renderToStaticMarkup(<Meta label="Product">x</Meta>)).not.toContain(">Size<");
  });
  test("wilaya: code and name in explicit order, name isolated", () => {
    expect(renderToStaticMarkup(<WilayaValue code={13} name="تلمسان" />)).toBe('<span class="num">13</span>-<bdi>تلمسان</bdi>');
  });
  test("wilaya: null or empty code renders the name only, no dash", () => {
    for (const code of [null, ""]) expect(renderToStaticMarkup(<WilayaValue code={code} name="Algiers" />)).toBe("<bdi>Algiers</bdi>");
  });
});

describe("VariantsEditor option names (real component)", () => {
  const opt = (name: string) => [{ id: "00000000-0000-4000-8000-000000000001", name, values: [{ id: "00000000-0000-4000-8000-000000000002", label: "S" }] }];
  const render = (l: "en" | "ar", name: string) => wrap(l, <VariantsEditor productId="p" initialOptions={opt(name)} initialVariants={[]} />);
  const expected = {
    en: { fallback: "Option 1", remove: "Remove Option 1", up: "Move Option 1 up" },
    ar: { fallback: "الخيار رقم 1", remove: "حذف الخيار رقم 1", up: "نقل الخيار رقم 1 للأعلى" },
  };
  for (const l of ["en", "ar"] as const) {
    for (const name of ["", "  "]) {
      test(`${l}: name ${JSON.stringify(name)} behaves as unnamed`, () => {
        const html = render(l, name);
        expect(html).toContain(`aria-label="${expected[l].remove}"`);
        expect(html).toContain(`aria-label="${expected[l].up}"`);
        expect(html).toContain(`placeholder="${expected[l].fallback}"`);
      });
    }
  }
  test("named option uses the name", () => {
    const html = render("en", "Size");
    expect(html).toContain('aria-label="Remove option Size"');
    expect(html).not.toContain("Remove Option 1");
  });
});
