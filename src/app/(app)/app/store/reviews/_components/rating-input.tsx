"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Rating 1..5 as a radio group: arrow keys move and select, one tab stop, 44px targets. */
export function RatingInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const t = useTranslations("store.admin.reviews");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (to: number) => {
    const n = Math.min(5, Math.max(1, to));
    onChange(n);
    refs.current[n - 1]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => {
            refs.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("ratingOption", { n })}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
            if (e.key === "ArrowRight") move(value + (rtl ? -1 : 1));
            else if (e.key === "ArrowLeft") move(value + (rtl ? 1 : -1));
            else if (e.key === "ArrowUp") move(value + 1);
            else if (e.key === "ArrowDown") move(value - 1);
            else return;
            e.preventDefault();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn("h-6 w-6", n <= value ? "fill-current text-warning" : "text-muted-foreground")} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
