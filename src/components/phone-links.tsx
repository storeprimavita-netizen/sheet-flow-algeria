"use client";

import { MessageCircle, Phone } from "lucide-react";

import { whatsappHref } from "@/lib/customers";

/** Tap-to-call + WhatsApp for a customer phone. Stops row-click propagation
 * so it works inside clickable table rows. */
export function PhoneLinks({ phone, callLabel, waLabel }: { phone: string; callLabel: string; waLabel: string }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  return (
    <span className="inline-flex items-center gap-1">
      <a href={`tel:${phone}`} onClick={stop} className="num text-xs text-muted-foreground hover:text-foreground hover:underline">
        {phone}
      </a>
      <a href={`tel:${phone}`} onClick={stop} className={btn} aria-label={callLabel} title={callLabel}>
        <Phone className="h-3.5 w-3.5" />
      </a>
      <a href={whatsappHref(phone)} onClick={stop} target="_blank" rel="noopener noreferrer" className={btn} aria-label={waLabel} title={waLabel}>
        <MessageCircle className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}
