"use client";

import { createContext, useContext } from "react";

import type { CounterKey } from "@/components/nav-model";

const CountsContext = createContext<Record<CounterKey, number> | null>(null);

/** Shares the layout's live nav counters with pages (no extra query). */
export const NavCountsProvider = CountsContext.Provider;

/** Live count badge for a hub card; renders nothing outside the shell. */
export function LeafCount({ counter }: { counter: CounterKey }) {
  const n = useContext(CountsContext)?.[counter];
  if (n === undefined) return null;
  return (
    <span
      className={
        n > 0
          ? "num ms-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary"
          : "num ms-auto rounded-full px-1.5 py-0.5 text-[11px] font-medium text-faint"
      }
    >
      {n}
    </span>
  );
}
