import type { ComponentType } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

const captured = vi.hoisted(() => ({ load: null as null | (() => Promise<ComponentType>) }));
vi.mock("next/dynamic", () => ({
  default: (load: () => Promise<ComponentType>) => {
    captured.load = load;
    return () => null;
  },
}));
vi.mock("@/components/dashboard/algeria-map", () => {
  throw new Error("chunk failed");
});

import "@/components/stats/wilaya-section";

test("a failed map chunk resolves to the map's own error state (EN and AR)", async () => {
  const Fallback = await captured.load!();
  for (const [locale, messages] of [["en", en], ["ar", ar]] as const) {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Algiers">
        <Fallback />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(messages.statistics.mapUnavailable);
    expect(html).toContain(messages.statistics.reloadPage);
  }
});
