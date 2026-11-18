import { MessageCircle } from "lucide-react";
import Link from "next/link";

import type { PublicProductPage } from "@/lib/store/data";

import { st } from "./t";

type Store = PublicProductPage["store"];

/** Public store chrome. Anything without data (announcement, WhatsApp, Instagram, phone) is hidden, never a dead end. */
export function StoreShell({ store, home, children }: { store: Store; home?: string; children: React.ReactNode }) {
  const { settings } = store;
  return (
    <>
      <a className="store-skip" href="#main">{st("skip")}</a>
      {settings.announcement ? <div className="store-announce">{settings.announcement}</div> : null}
      <header className="store-header">
        <div className="store-wrap">
          {home ? (
            <Link className="store-brand" href={home} aria-label={st("homeLabel")}>
              <bdi>{store.name}</bdi>
            </Link>
          ) : (
            <span className="store-brand"><bdi>{store.name}</bdi></span>
          )}
        </div>
      </header>
      <main className="store-main" id="main">
        <div className="store-wrap">{children}</div>
      </main>
      <footer className="store-footer">
        <div className="store-wrap">
          <span className="store-footer-brand"><bdi>{store.name}</bdi></span>
          {settings.slogan ? <p>{settings.slogan}</p> : null}
          {settings.phone || settings.instagramUrl ? (
            <nav aria-label={st("contact")} style={{ display: "flex", gap: "var(--space-4)" }}>
              {settings.phone ? <a className="ltr" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>{settings.phone}</a> : null}
              {settings.instagramUrl ? <a href={settings.instagramUrl} rel="noopener noreferrer" target="_blank">{st("instagram")}</a> : null}
            </nav>
          ) : null}
        </div>
      </footer>
      {settings.whatsappUrl ? (
        <a className="store-whatsapp" href={settings.whatsappUrl} rel="noopener noreferrer" target="_blank" aria-label={st("whatsappAria")}>
          <MessageCircle aria-hidden="true" size={26} strokeWidth={1.5} />
        </a>
      ) : null}
    </>
  );
}
