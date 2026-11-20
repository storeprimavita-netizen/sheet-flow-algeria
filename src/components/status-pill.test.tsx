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
      expect(html).toContain('<span class="shrink-0">🔥</span>');
      expect(html).toContain("Hot");
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

describe("StatusPill emoji-only override", () => {
  test("keeps the default label as sr-only text; a text override gets none", () => {
    const html = render({ confirmation: { confirmed: { en: "✅", ar: null } } }, <StatusPill kind="confirmation" status="confirmed" compact />);
    expect(html).toContain('<span class="sr-only">status.confirmation_status.confirmed</span>');
    expect(render(emojiOv, <StatusPill kind="confirmation" status="confirmed" />)).not.toContain("sr-only");
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

describe("StatusPill layout", () => {
  test("no truncate class unless asked (select triggers), gap span for a leading emoji", () => {
    const html = render(emojiOv, <StatusPill kind="confirmation" status="confirmed" size="sm" compact />);
    expect(html).not.toContain("truncate");
    expect(html).not.toContain("max-w-");
    expect(html).toContain("gap-1");
    expect(html).toContain('title="🔥 Hot"');
    expect(render(emojiOv, <StatusPill kind="confirmation" status="confirmed" truncate />)).toContain("truncate");
  });
});

describe("server-render smoke", () => {
  test("a server component importing StatusPill renders (catches a lost use client)", async () => {
    async function ServerPage() {
      return <StatusPill kind="confirmation" status="confirmed" />;
    }
    const html = renderToStaticMarkup(await ServerPage());
    expect(html).toContain("status.confirmation_status.confirmed");
  });
});
