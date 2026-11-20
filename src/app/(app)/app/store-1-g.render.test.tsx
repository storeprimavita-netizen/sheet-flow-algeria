import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/status-pill";
import { Meta, SizeMeta, WilayaValue } from "./orders/[id]/order-meta";
import { VariantsFeedback } from "./products/_components/variants-feedback";

const locales = { en, ar } as const;
const wrap = (locale: "en" | "ar", node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locales[locale]}>
      {node}
    </NextIntlClientProvider>,
  );

describe("unnamed option accessible names", () => {
  const names = {
    en: { moveUp: "Move Option 1 up", moveDown: "Move Option 1 down", remove: "Remove Option 1", add: "Add value to Option 1", value: "Value 2 of Option 1" },
    ar: { moveUp: "نقل الخيار رقم 1 للأعلى", moveDown: "نقل الخيار رقم 1 للأسفل", remove: "حذف الخيار رقم 1", add: "إضافة قيمة إلى الخيار رقم 1", value: "القيمة 2 من الخيار رقم 1" },
  };
  for (const l of ["en", "ar"] as const) {
    test(l, () => {
      const t = createTranslator({ locale: l, messages: locales[l], namespace: "variants" });
      const name = t("optionFallback", { n: 1 });
      expect(t("moveOptionUp", { name })).toBe(names[l].moveUp);
      expect(t("moveOptionDown", { name })).toBe(names[l].moveDown);
      expect(t("removeOption", { name })).toBe(names[l].remove);
      expect(t("addValue", { name })).toBe(names[l].add);
      expect(t("valueNumbered", { n: 2, option: name })).toBe(names[l].value);
    });
  }
});

describe("variants feedback", () => {
  for (const l of ["en", "ar"] as const) {
    test(`${l}: stale is a role=alert with the localized text`, () => {
      const html = wrap(l, <VariantsFeedback unsaved result={{ ok: false, code: "stale" } as never} />);
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

describe("stock page pills", () => {
  test("level chip never wraps; Count needed pill renders its label", () => {
    expect(renderToStaticMarkup(<Chip token="warning" size="sm" className="whitespace-nowrap">3 · Low</Chip>)).toContain("whitespace-nowrap");
    expect(wrap("en", <StatusPill kind="stock" status="count_needed" size="sm" />)).toMatch(/Count needed/i);
  });
});

describe("order page cells", () => {
  const size = (show: boolean) => renderToStaticMarkup(<>{show ? <SizeMeta label="Size" size="M / Red" /> : null}<Meta label="Product">x</Meta></>);
  test("agent (no card) sees the size once", () => {
    expect(size(true).match(/>Size</g)).toHaveLength(1);
    expect(size(true)).toContain("<bdi>M / Red</bdi>");
  });
  test("admin with the size card: the Meta cell is not rendered", () => {
    expect(size(false)).not.toContain(">Size<");
  });
  test("wilaya: code and name in explicit order, name isolated", () => {
    const html = renderToStaticMarkup(<WilayaValue code={13} name="تلمسان" />);
    expect(html).toBe('<span class="num">13</span>-<bdi>تلمسان</bdi>');
  });
});
