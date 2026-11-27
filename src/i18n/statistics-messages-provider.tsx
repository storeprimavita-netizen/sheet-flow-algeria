"use client";

import { NextIntlClientProvider, useLocale, useMessages, type AbstractIntlMessages } from "next-intl";

/** Adds the `statistics` namespace, which the root client payload leaves out. */
export function StatisticsMessagesProvider({
  statistics,
  children,
}: {
  statistics: AbstractIntlMessages[string];
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const messages = useMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={{ ...messages, statistics }}>
      {children}
    </NextIntlClientProvider>
  );
}
