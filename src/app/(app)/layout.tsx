import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";

import { dirFor } from "@/i18n/config";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";
import "./globals.css";

// Self-hosted at build time; the font stack is in globals.css.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-arabic",
});

export const metadata: Metadata = {
  title: "MNW ERP",
  description: "MNW — Cash on Delivery ERP",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // `statistics` is large and only two routes read it on the client; their
  // layouts add it back (StatisticsMessagesProvider).
  const { statistics: _scoped, ...messages } = await getMessages();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : defaultTheme;

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${theme} ${plexSans.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
