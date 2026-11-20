import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "en",
}));

import { StatusPill } from "@/components/status-pill";
import { StatusLabelsProvider } from "@/components/status-labels-provider";
import { Chip } from "@/components/ui/chip";

const render = (overrides: Parameters<typeof StatusLabelsProvider>[0]["overrides"] | null, node: React.ReactElement) =>
  renderToStaticMarkup(overrides ? <StatusLabelsProvider overrides={overrides}>{node}</StatusLabelsProvider> : node);
const emojiOv = { confirmation: { confirmed: { en: "🔥 Hot", ar: null } } };
const textOv = { confirmation: { confirmed: { en: "Good", ar: null } } };

describe("StatusPill", () => {
  test("without a provider (store/login) it shows the default and the icon", () => {
    const html = render(null, <StatusPill kind="confirmation" status="confirmed" />);
    expect(html).toContain("status.confirmation_status.confirmed");
    expect(html).toContain("<svg");
  });
  test("an emoji label hides the icon in full, compact and sm", () => {
    for (const p of [{}, { compact: true }, { size: "sm" as const }]) {
      const html = render(emojiOv, <StatusPill kind="confirmation" status="confirmed" {...p} />);
      expect(html).toContain("🔥 Hot");
      expect(html).not.toContain("<svg");
    }
  });
  test("a text override keeps the icon; special characters are escaped, not parsed", () => {
    expect(render(textOv, <StatusPill kind="confirmation" status="confirmed" />)).toContain("<svg");
    const html = render({ confirmation: { confirmed: { en: `'' {x} <i> #`, ar: null } } }, <StatusPill kind="confirmation" status="confirmed" />);
    expect(html).toContain("&lt;i&gt;");
    expect(html).toContain("{x}");
  });
});

describe("Chip emoji", () => {
  test("decorative (aria-hidden) beside text; emoji-only gets an sr-only name", () => {
    expect(renderToStaticMarkup(<Chip emoji="🔥">Hot</Chip>)).toContain('aria-hidden="true"');
    const only = renderToStaticMarkup(<Chip emoji="🔥" emojiLabel="Hot" />);
    expect(only).not.toContain('aria-hidden');
    expect(only).toContain('class="sr-only"');
  });
});
