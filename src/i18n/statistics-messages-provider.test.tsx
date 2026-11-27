import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import StatisticsError from "@/app/(app)/app/statistics/error";
import { StatisticsMessagesProvider } from "@/i18n/statistics-messages-provider";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

describe("statistics messages provider keeps shared and scoped keys", () => {
  test.each([
    ["en", en],
    ["ar", ar],
  ])("%s", (locale, messages) => {
    const { statistics, ...root } = messages;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale={locale}
        messages={root}
        timeZone="Africa/Algiers"
        onError={(e) => {
          throw e;
        }}
      >
        <StatisticsMessagesProvider statistics={statistics}>
          <StatisticsError error={new Error("x")} unstable_retry={() => {}} />
        </StatisticsMessagesProvider>
      </NextIntlClientProvider>,
    );
    const text = html.replaceAll("&#x27;", "'");
    expect(text).toContain(messages.errorPage.retry); // shared
    expect(text).toContain(statistics.errorTitle); // scoped
  });
});
