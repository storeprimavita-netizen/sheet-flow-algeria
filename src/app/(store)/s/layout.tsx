import type { Metadata, Viewport } from "next";
import { Aref_Ruqaa, El_Messiri, Marcellus, Tajawal } from "next/font/google";

import { StoreIntlProvider } from "@/components/store/intl-provider";
import "@/components/store/store.css";

// Own root layout: fixed Arabic/RTL, no cookies, no app theme class, no Toaster, no app fonts.
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], display: "swap", variable: "--font-tajawal", adjustFontFallback: true });
const elMessiri = El_Messiri({ subsets: ["arabic", "latin"], weight: ["600"], display: "swap", variable: "--font-el-messiri" });
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-marcellus", preload: false });
const arefRuqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: "700", display: "swap", variable: "--font-aref-ruqaa", preload: false });

export const metadata: Metadata = { robots: { index: false, follow: false } };

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6F0" }, // gate-allow-color: meta theme-color cannot use CSS variables; equals --surface-100
    { media: "(prefers-color-scheme: dark)", color: "#1C1013" }, // gate-allow-color: same, dark --surface-100
  ],
};

export default function StoreRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${elMessiri.variable} ${marcellus.variable} ${arefRuqaa.variable}`}>
      <body className="store-root">
        <StoreIntlProvider>{children}</StoreIntlProvider>
      </body>
    </html>
  );
}
