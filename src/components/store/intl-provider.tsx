"use client";

import { NextIntlClientProvider } from "next-intl";

import { storeMessages } from "./t";

// Client-side provider: unlike the server variant it never calls the request config (which reads the locale cookie).
export function StoreIntlProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="ar" messages={{ store: storeMessages }} timeZone="Africa/Algiers">
      {children}
    </NextIntlClientProvider>
  );
}
